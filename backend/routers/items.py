from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from app_models import Item, User
from auth import get_current_user
import boto3, os, uuid
from datetime import datetime

router = APIRouter()

def upload_to_s3(file: UploadFile) -> str:
    """Upload file to S3 and return URL. Falls back to placeholder if not configured."""
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )
        bucket = os.getenv("S3_BUCKET_NAME", "csmms-bucket")
        key = f"items/{uuid.uuid4()}_{file.filename}"
        s3.upload_fileobj(file.file, bucket, key, ExtraArgs={"ACL": "public-read"})
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    except Exception:
        return f"https://placehold.co/400x300?text={file.filename}"

class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    category: str

class ItemResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    price: str
    category: str
    image_url: Optional[str]
    is_available: bool
    owner_id: int
    owner_name: str = ""
    created_at: datetime
    class Config:
        from_attributes = True

@router.get("/", response_model=List[dict])
def list_items(
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Item).filter(Item.is_available == True)
    if keyword:
        query = query.filter(Item.title.ilike(f"%{keyword}%"))
    if category:
        query = query.filter(Item.category == category)
    if min_price is not None:
        query = query.filter(Item.price >= min_price)
    if max_price is not None:
        query = query.filter(Item.price <= max_price)
    items = query.order_by(Item.created_at.desc()).all()
    result = []
    for item in items:
        owner = db.query(User).filter(User.id == item.owner_id).first()
        result.append({
            "id": item.id, "title": item.title, "description": item.description,
            "price": item.price, "category": item.category, "image_url": item.image_url,
            "is_available": item.is_available, "owner_id": item.owner_id,
            "owner_name": owner.name if owner else "Unknown",
            "created_at": item.created_at.isoformat()
        })
    return result

@router.post("/")
async def create_item(
    title: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    category: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    image_url = None
    if image and image.filename:
        image_url = upload_to_s3(image)
    item = Item(
        title=title, description=description, price=price,
        category=category, image_url=image_url, owner_id=current_user.id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "title": item.title, "message": "Item created successfully"}

@router.put("/{item_id}")
def update_item(item_id: int, data: ItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id, Item.owner_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in data.dict().items():
        setattr(item, k, v)
    db.commit()
    return {"message": "Item updated"}

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id, Item.owner_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}

@router.get("/my", response_model=List[dict])
def my_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(Item).filter(Item.owner_id == current_user.id).all()
    return [{"id": i.id, "title": i.title, "price": i.price, "category": i.category,
             "is_available": i.is_available, "image_url": i.image_url} for i in items]

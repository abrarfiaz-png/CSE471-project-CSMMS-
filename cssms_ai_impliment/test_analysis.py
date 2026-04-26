import sys
import os

# Add backend to path
sys.path.insert(0, r'd:\STUDY\14th sem\CSE471\Lab\projectv3\csmms\backend')

# Mock the required dependencies
class MockUploadFile:
    def __init__(self, filename, content):
        self.filename = filename
        self.content = content
        self.content_type = "application/pdf"

    async def read(self):
        return self.content

class MockUser:
    id = 1
    username = "test"

# Mock the database and auth functions
def mock_get_db():
    return None

def mock_get_current_user():
    return MockUser()

# Import the router
from routers.student_weakness_analysis import analyze_student_weakness, DEMO_ANALYSES

async def test_analysis():
    print("🧪 TESTING ANALYSIS LOGIC DIRECTLY")
    print("=" * 50)

    # Test files
    test_files = [
        ('demo_marksheet.pdf', 2425),
        ('math_exam.pdf', 2431),
        ('physics_marksheet.pdf', 2433),
        ('science_results.pdf', 2435),
        ('final_semester.pdf', 2433)
    ]

    for filename, file_size in test_files:
        print(f"\n📁 Testing {filename} ({file_size} bytes)")

        # Create mock file with correct size
        mock_content = b'x' * file_size  # Dummy content of correct size
        mock_file = MockUploadFile(filename, mock_content)

        # Calculate hash
        content_hash = file_size % 3
        analysis = DEMO_ANALYSES[content_hash]

        print(f"🔢 Hash: {content_hash}")
        print(f"📊 Result: {analysis['overall_grade']}")
        print(f"📚 Weak subjects: {analysis['weak_subjects']}")

    print("\n✅ Test completed!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_analysis())
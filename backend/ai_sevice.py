import openai

openai.api_key = "YOUR_API_KEY"

def analyze_student(marks_data):
    prompt = f"""
    Analyze the marks: {marks_data}
    
    1. Find weak subjects
    2. Generate tutor assistance summary
    3. Create a simple study plan
    """

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response['choices'][0]['message']['content']

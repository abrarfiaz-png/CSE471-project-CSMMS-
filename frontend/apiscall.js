fetch("http://localhost:8000/module3/analyze-student", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    student_name: "Arnab",
    marks_data: "Math:40, Physics:50, CSE:80"
  })
})
.then(res => res.json())
.then(data => console.log(data));

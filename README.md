🌿 NutriGenius AI — IBM Watsonx.ai Nutrition & Fitness Agent
> An AI-powered, full-stack Nutrition & Fitness web application built with **Python Flask** and **IBM Watsonx.ai Granite** models. Featuring a premium glassmorphism UI, conversational chat, meal planning, yoga routines, BMI calculator, food scanning, family profiles, voice input, and multilingual (English/Hindi/Hinglish) support.
---
✨ Feature Highlights
Feature	Details
🤖 AI Chat	Conversational nutrition & fitness coach (IBM Granite 3.3-8B)
🍱 Meal Planner	Full 3-course daily plans with macros & calorie estimates
🔥 Calorie Counter	Log foods, get macro breakdown & AI analysis
📸 Food Scanner	Upload meal photo or describe food for nutritional analysis
🧘 Yoga Builder	8 demographic profiles × multiple focus areas
⚖️ BMI Calculator	BMI + BMR + AI-powered health insights
👨‍👩‍👧‍👦 Family Planner	Personalised plans for every family member
🎤 Voice Assistant	Web Speech API — English & Hindi (en-IN)
🌙 Dark Mode	Full dark/light theme toggle
📱 Responsive	Mobile-first, works perfectly on all screen sizes
---
🗂️ Project Structure
```
nutri/
├── app.py                    # Flask backend + Watsonx.ai integration + AGENT_INSTRUCTIONS
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── .env                      # Your actual credentials (DO NOT commit!)
├── templates/
│   └── index.html            # Single-page application HTML
├── static/
│   ├── css/
│   │   └── style.css         # Premium CSS design system
│   └── js/
│       └── app.js            # Frontend logic (chat, voice, API calls)
└── README.md
```
---
⚙️ Setup & Installation
1. Prerequisites
Python 3.9 or higher
An IBM Cloud account with Watsonx.ai access
An active IBM Watsonx.ai project
2. Get IBM Credentials
IBM API Key:
Log in to IBM Cloud
Go to Manage → Access (IAM) → API keys
Click Create an IBM Cloud API key
Copy and save the key
Watsonx Project ID:
Go to IBM Watsonx.ai
Open your project → Manage → General
Copy the Project ID from the top
Watsonx URL:  
Use the URL for your region:
US South: `https://us-south.ml.cloud.ibm.com`
EU Frankfurt: `https://eu-de.ml.cloud.ibm.com`
UK South: `https://eu-gb.ml.cloud.ibm.com`
Tokyo: `https://jp-tok.ml.cloud.ibm.com`
3. Clone & Install
```bash
# Clone or download the project
cd nutri

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```
4. Configure Environment
```bash
# Copy the example file
cp .env.example .env
```
Edit `.env` with your actual credentials:
```env
IBM_API_KEY=your_actual_ibm_cloud_api_key
IBM_PROJECT_ID=your_watsonx_project_id
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=any-long-random-string-here
FLASK_DEBUG=False
FLASK_PORT=5000
```
5. Run the Application
```bash
python app.py
```
Open your browser at: http://localhost:5000
---
🧠 Customising Agent Behaviour (`AGENT_INSTRUCTIONS`)
The entire AI personality, rules, and specialisations live in the `AGENT_INSTRUCTIONS` block at the top of `app.py`. Edit this block to:
```python
# In app.py — find AGENT_INSTRUCTIONS and edit:

AGENT_INSTRUCTIONS = """
## PERSONALITY & TONE
- Change the agent's name, personality, tone...

## INDIAN FOOD PREFERENCE DEFAULTS  
- Add/remove regional cuisines, default ingredients...

## CHRONIC HEALTH CONDITIONS
- Add new conditions (e.g., Kidney Disease, Gout)...

## SEVERE FOOD ALLERGIES
- Add/remove allergens (e.g., shellfish, sesame)...

## MEAL PLAN GENERATION RULES
- Change number of courses, structure, format...

## YOGA ROUTINE BUILDER RULES
- Add new demographic profiles, pose requirements...

## SAFETY & ETHICAL RULES
- Adjust safety thresholds and guidelines...
"""
```
No other code changes are needed — the AGENT_INSTRUCTIONS section is the single control panel for all AI behaviour.
---
🔌 API Endpoints
Method	Endpoint	Description
`POST`	`/api/chat`	Main conversational chat
`POST`	`/api/meal-plan`	Generate full-day meal plan
`POST`	`/api/yoga-routine`	Build targeted yoga routine
`POST`	`/api/bmi`	Calculate BMI + AI insights
`POST`	`/api/analyze-image`	Analyse meal photo or food description
`POST`	`/api/family-plan`	Multi-member family nutrition plan
`POST`	`/api/nutrition-facts`	Detailed nutrition facts for a food
`POST`	`/api/calorie-counter`	Calorie & macro analysis for food log
Example API Call
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a diabetic-friendly breakfast plan for me",
    "history": [],
    "profile": {
      "age": 45,
      "gender": "female",
      "conditions": ["Diabetes"],
      "diet_type": "vegetarian",
      "cuisine": "south_indian"
    }
  }'
```
---
🚀 Deployment
Option A: Local (Development)
```bash
python app.py
```
Option B: Production with Gunicorn
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```
Option C: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```
```bash
docker build -t nutrigenius-ai .
docker run -p 5000:5000 --env-file .env nutrigenius-ai
```
Option D: IBM Code Engine / Cloud Foundry
```bash
# IBM Cloud CLI
ibmcloud login
ibmcloud target -r us-south -g Default

# Deploy to Code Engine
ibmcloud ce application create \
  --name nutrigenius-ai \
  --image us.icr.io/your-namespace/nutrigenius-ai \
  --env-from-secret nutrigenius-secrets \
  --port 5000
```
---
🔒 Security Notes
Never commit `.env` — it is excluded via `.gitignore`
Change `FLASK_SECRET_KEY` to a long random string in production
Set `FLASK_DEBUG=False` in production
Use environment variables or IBM Secrets Manager for credentials in production deployments
Consider adding rate limiting (`flask-limiter`) for public deployments
---
🌍 Multilingual Support
The agent supports:
English — Default
हिंदी (Hindi) — Type in Devanagari or select Hindi in profile
Hinglish — Mixed Hindi-English, detected automatically
The Web Speech API voice input is configured for `en-IN` (Indian English) which also recognises common Hindi words and phrases.
---
🤝 IBM Watsonx.ai Model Details
Setting	Value
Model	`ibm/granite-3-3-8b-instruct`
Max tokens	2048
Temperature	0.7
Top-P	0.9
Repetition Penalty	1.1
To use a different Granite model, change `model_id` in `app.py`:
```python
model = ModelInference(
    model_id="ibm/granite-3-3-8b-instruct",   # Change this
    ...
)
```
Available Granite models on Watsonx.ai:
`ibm/granite-3-3-8b-instruct` (recommended)
`ibm/granite-3-2-8b-instruct`
`ibm/granite-3-8b-instruct`
`ibm/granite-13b-instruct-v2`
---
📦 Dependencies
```
flask==3.0.3            # Web framework
python-dotenv==1.0.1    # .env file support
ibm-watsonx-ai==1.1.2   # IBM Watsonx.ai SDK
ibm-cloud-sdk-core==3.20.3
requests==2.32.3
Pillow==10.4.0          # Image processing
base64io==1.0.3
gunicorn==22.0.0        # Production WSGI server
```
---
🐛 Troubleshooting
Error	Solution
`401 Unauthorized`	Check your IBM_API_KEY in .env
`404 Project not found`	Verify IBM_PROJECT_ID is correct
`Connection refused`	Check IBM_WATSONX_URL matches your region
`ModuleNotFoundError`	Run `pip install -r requirements.txt` in activated venv
Voice not working	Use Chrome or Edge; grant microphone permission
Images not loading	Check `static/` folder path; use `flask run` not direct Python
---
📄 License
MIT License — Free to use, modify, and deploy.
---
Built with ❤️ using IBM Watsonx.ai Granite · Flask · Vanilla JS

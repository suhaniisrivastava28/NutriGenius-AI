"""
=============================================================================
  NutriGenius AI — Flask + IBM Watsonx.ai (Granite) Backend
  Author : IBM Watsonx.ai Demo
  Description : AI-powered Nutrition & Fitness Agent
=============================================================================
"""

import os
import json
import base64
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# IBM Watsonx.ai SDK — compatible with both 1.1.x and 1.5.x
# ---------------------------------------------------------------------------
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

# GenTextParamsMetaNames moved in SDK 1.1.3+
try:
    from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
except ImportError:
    from ibm_watsonx_ai.foundation_models.utils.enums import GenTextParamsMetaNames as GenParams

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrigenius-secret-2025")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# IBM Watsonx.ai client
# ---------------------------------------------------------------------------
IBM_API_KEY    = os.getenv("IBM_API_KEY", "")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "")
IBM_URL        = os.getenv("IBM_WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

# Generation parameters
GEN_PARAMS = {
    "max_new_tokens":      2048,
    "min_new_tokens":      100,
    "temperature":         0.7,
    "top_p":               0.9,
    "top_k":               50,
    "repetition_penalty":  1.1,
}

# ---------------------------------------------------------------------------
# Lazy model initialisation — SDK 1.5.x authenticates to IBM IAM at
# construction time, so we defer creation until the first real API call.
# This lets Flask start up cleanly even before credentials are verified.
# ---------------------------------------------------------------------------
_model = None

def get_model() -> ModelInference:
    """Return (and lazily create) the Watsonx ModelInference client."""
    global _model
    if _model is None:
        if not IBM_API_KEY or IBM_API_KEY in ("", "your_ibm_cloud_api_key_here"):
            raise RuntimeError(
                "IBM_API_KEY is not set. Please fill in your .env file "
                "(see .env.example) and restart the server."
            )
        if not IBM_PROJECT_ID or IBM_PROJECT_ID in ("", "your_watsonx_project_id_here"):
            raise RuntimeError(
                "IBM_PROJECT_ID is not set. Please fill in your .env file "
                "(see .env.example) and restart the server."
            )
        credentials = Credentials(url=IBM_URL, api_key=IBM_API_KEY)
        _model = ModelInference(
            model_id="ibm/granite-4-h-small",
            credentials=credentials,
            project_id=IBM_PROJECT_ID,
            params=GEN_PARAMS,
        )
        logger.info("Watsonx ModelInference client initialised successfully.")
    return _model

# ---------------------------------------------------------------------------
# ███████╗  AGENT INSTRUCTIONS  ██████████████████████████████████████████████
# Edit this block to fully customise the agent's behaviour, tone, diet
# specialisations, safety rules, allergens, health conditions, and preferences.
# ---------------------------------------------------------------------------
AGENT_INSTRUCTIONS = """
You are NutriGenius, a world-class AI-powered Nutrition & Fitness Coach built by IBM Watsonx.ai.

## PERSONALITY & TONE
- Warm, encouraging, and empathetic — like a knowledgeable friend who is also a certified dietitian.
- Blend professional expertise with approachable language; switch fluently between English, Hindi,
  and Hinglish when the user communicates in Hindi or Hinglish.
- Always motivate the user; never shame or judge dietary choices.
- Keep responses structured, scannable, and actionable.

## CORE EXPERTISE
- Certified Sports Nutritionist, Registered Dietitian, Yoga & Wellness Coach.
- Deep knowledge of Ayurvedic principles, Indian regional cuisines (North, South, East, West),
  and global nutrition science (Mediterranean, DASH, Keto, Intermittent Fasting, etc.).
- Expert in macro/micro nutrient analysis, glycaemic index, and meal timing strategies.

## INDIAN FOOD PREFERENCE DEFAULTS
- Prioritise Indian regional ingredients: dals, sabzis, rotis, rice, idli, dosa, poha, upma,
  raita, lassi, chaas, seasonal fruits, and spices (turmeric, cumin, coriander, fenugreek).
- Suggest Western alternatives only when explicitly asked or when Indian options are unavailable.
- Respect vegetarian/vegan/Jain dietary preferences as the default; ask before assuming non-veg.

## CHRONIC HEALTH CONDITIONS (apply always unless user profile overrides)
- DIABETES (Type 2): Low glycaemic index foods, complex carbs, no refined sugar, monitor
  portion sizes, include bitter gourd, fenugreek, cinnamon.
- HYPERTENSION: Low sodium (<2 g/day), DASH-compliant, potassium-rich foods, avoid pickles/
  papads/processed foods.
- PCOD/PCOS: Anti-inflammatory diet, low-sugar, high-fibre, include flaxseeds & omega-3.
- THYROID (Hypothyroid): Avoid raw cruciferous veg in large amounts; include selenium-rich foods.
- HEART DISEASE: Limit saturated fat, trans fat, cholesterol; include omega-3, soluble fibre.
- Always mention when a recommendation is modified for a health condition.

## SEVERE FOOD ALLERGIES & INTOLERANCES (flag prominently with ⚠️)
- NUTS: Avoid all tree nuts and peanuts; suggest seeds (sunflower, pumpkin, chia) as substitutes.
- GLUTEN: Avoid wheat, barley, rye; use rice, jowar, bajra, ragi, quinoa alternatives.
- DAIRY: Avoid milk, paneer, curd, ghee; suggest coconut milk, almond milk, soy alternatives.
- EGGS: Avoid eggs; boost protein via legumes, tofu, tempeh.
- Always cross-check every meal suggestion against the user's active allergy list.

## MEAL PLAN GENERATION RULES (STRICT)
When generating a meal plan:
1. ALWAYS produce a FULL DAY covering:
   - 🌅 Breakfast (with 2 options)
   - 🥗 Mid-Morning Snack
   - 🍱 Lunch (with 2 options — one light, one hearty)
   - 🍎 Evening Snack
   - 🌙 Dinner (with 2 options)
   - 💧 Daily Hydration & Supplement tips
2. Include calorie estimate, macros (protein/carbs/fat/fibre) for EACH meal.
3. Provide a DAILY TOTAL summary.
4. Explain WHY each food is chosen for the user's specific profile.
5. Offer one quick swap for each meal if the user is short on time or ingredients.

## YOGA ROUTINE BUILDER RULES (STRICT)
When building a yoga routine:
1. Categorise by profile: Beginners | Seniors | Working Professionals |
   Pregnant Women | Athletes | Lower Back Pain | Stress/Anxiety | Insomnia.
2. Provide 6–8 poses minimum per routine with:
   - Sanskrit name + English name
   - Duration / repetitions
   - Step-by-step instructions (3–4 steps)
   - Specific benefit for this user's profile
   - Modification for beginners or physical limitations
3. Structure: Warm-up → Main Sequence → Cool-down / Savasana.

## IMAGE / LABEL ANALYSIS RULES
When the user shares a meal photo or grocery label:
1. Identify all visible ingredients/items.
2. Estimate calories and macros (protein, carbs, fat, fibre, sodium).
3. Cross-check against user's allergies and health conditions.
4. Flag any ⚠️ ALLERGEN or ❌ HEALTH RISK prominently.
5. Suggest a healthier swap or modification.

## SAFETY & ETHICAL RULES
- NEVER provide medical diagnoses or prescribe medications.
- Always recommend consulting a qualified doctor for serious conditions.
- If a user mentions extreme calorie restriction (<800 kcal/day), eating disorders, or self-harm,
  respond with empathy, do not provide the requested plan, and suggest professional help.
- Do not generate plans that could be dangerous for pregnant women without mentioning
  "Please consult your gynaecologist before following this plan."
- Respect all religious dietary laws (halal, kosher, Jain, Sattvic).

## RESPONSE FORMATTING
- Use emojis sparingly but meaningfully (🥗🏋️🧘🌿💧⚠️).
- Use markdown tables for meal plans and calorie comparisons.
- Use numbered lists for yoga poses and step-by-step instructions.
- Keep explanations concise yet complete — no unnecessary filler text.
- For multilingual responses, respond in the same language/mix the user writes in.
"""

# ---------------------------------------------------------------------------
# Helper — build messages list (chat API format)
# ---------------------------------------------------------------------------
def build_messages(system_instructions: str, history: list, user_message: str) -> list:
    """Build an OpenAI-style messages list for the Watsonx chat API."""
    messages = [{"role": "system", "content": system_instructions}]
    for turn in history[-8:]:        # keep last 8 turns for context window
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})
    return messages


# Keep a plain-prompt fallback for compatibility
def build_prompt(system_instructions: str, history: list, user_message: str) -> str:
    """Fallback: Granite-style tagged prompt string."""
    prompt = f"<|system|>\n{system_instructions}\n"
    for turn in history[-8:]:
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        prompt += f"<|{role}|>\n{content}\n"
    prompt += f"<|user|>\n{user_message}\n<|assistant|>\n"
    return prompt


def call_watsonx(system_instructions: str, history: list, user_message: str) -> str:
    """Call the Watsonx.ai chat endpoint and return the assistant's reply.

    Uses the newer /ml/v1/text/chat API (no deprecation warning).
    Falls back to generate_text if chat is not available for the model.
    """
    try:
        messages = build_messages(system_instructions, history, user_message)
        response = get_model().chat(messages=messages)

        # chat() returns: {"choices": [{"message": {"content": "..."}}]}
        choices = response.get("choices", [])
        text    = choices[0].get("message", {}).get("content", "") if choices else ""
        return text.strip() if text else "I'm sorry, I couldn't generate a response. Please try again."

    except Exception as chat_exc:
        # Fallback: some models may not support chat — use generate_text
        logger.warning("chat() failed (%s), falling back to generate_text", chat_exc)
        try:
            prompt   = build_prompt(system_instructions, history, user_message)
            response = get_model().generate_text(prompt=prompt)
            if isinstance(response, dict):
                results = response.get("results", [])
                text    = results[0].get("generated_text", "") if results else ""
            else:
                text = response or ""
            return text.strip() if text else "I'm sorry, I couldn't generate a response. Please try again."
        except Exception as exc:
            logger.error("Watsonx error: %s", exc)
            return f"⚠️ Error connecting to IBM Watsonx.ai: {str(exc)}"


# ---------------------------------------------------------------------------
# Routes — pages
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    session.setdefault("chat_history", [])
    session.setdefault("user_profile", {})
    _init_dashboard_session()
    return render_template("index.html")


def _init_dashboard_session():
    """Seed the dashboard tracking matrix into the session if not yet present."""
    if "dashboard" not in session:
        session["dashboard"] = {
            "calories_goal":    2100,
            "calories_consumed": 1840,
            "protein_goal":     80,
            "protein_consumed": 68,
            "carbs_goal":       380,
            "carbs_consumed":   245,
            "fat_goal":         70,
            "fat_consumed":     38,
            "fibre_goal":       25,
            "fibre_consumed":   18,
            "water_goal":       8,
            "water_logged":     6,
            "steps_goal":       10000,
            "steps_logged":     7240,
            "next_meal_id":     5,
            "meals_list": [
                {"id": 1, "type": "Breakfast", "name": "Poha + Chai",          "calories": 320, "time": "8:00 AM",  "protein": 8,  "carbs": 52, "fat": 6},
                {"id": 2, "type": "Snack",     "name": "Apple + Almonds",       "calories": 180, "time": "11:00 AM", "protein": 4,  "carbs": 22, "fat": 9},
                {"id": 3, "type": "Lunch",     "name": "Dal Rice + Salad",      "calories": 680, "time": "1:30 PM",  "protein": 28, "carbs": 98, "fat": 14},
                {"id": 4, "type": "Snack",     "name": "Green Tea + Khakhra",   "calories": 120, "time": "4:00 PM",  "protein": 3,  "carbs": 18, "fat": 4},
            ],
        }


# ── Dashboard API helpers ────────────────────────────────────────────────────

def _meal_type_emoji(meal_type: str) -> str:
    return {"Breakfast": "🌅", "Lunch": "🍱", "Dinner": "🌙", "Snack": "🍎"}.get(meal_type, "🍽️")


def _estimate_macros(calories: int) -> dict:
    """Rough macro split from calorie density: 50% carbs / 20% protein / 30% fat."""
    return {
        "protein": round(calories * 0.20 / 4),   # 4 kcal/g
        "carbs":   round(calories * 0.50 / 4),
        "fat":     round(calories * 0.30 / 9),   # 9 kcal/g
        "fibre":   round(calories * 0.02 / 2),
    }


# ---------------------------------------------------------------------------
# Routes — Dashboard CRUD API
# ---------------------------------------------------------------------------

@app.route("/api/dashboard/data", methods=["GET"])
def dashboard_data():
    """Return the full dashboard state from session."""
    _init_dashboard_session()
    return jsonify(session["dashboard"])


@app.route("/api/dashboard/add_meal", methods=["POST"])
def dashboard_add_meal():
    """Add a meal entry, update totals, return updated dashboard state."""
    _init_dashboard_session()
    data      = request.get_json(force=True)
    meal_type = data.get("type", "Snack").strip()
    name      = data.get("name", "").strip()
    try:
        calories = int(data.get("calories", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "calories must be a number"}), 400

    if not name or calories <= 0:
        return jsonify({"error": "name and calories are required"}), 400

    macros  = _estimate_macros(calories)
    # Cross-platform safe time string (no %-I which crashes on Windows)
    now_str = datetime.now().strftime("%I:%M %p").lstrip("0") or "12:00 AM"

    # Deep-copy the session dict so Flask detects the mutation reliably
    d       = dict(session["dashboard"])
    meal_id = d["next_meal_id"]
    new_meal = {
        "id":      meal_id,
        "type":    meal_type,
        "name":    name,
        "calories": calories,
        "time":    now_str,
        "protein": macros["protein"],
        "carbs":   macros["carbs"],
        "fat":     macros["fat"],
        "fibre":   macros["fibre"],
    }

    d["meals_list"]        = d["meals_list"] + [new_meal]   # new list → forces session diff
    d["calories_consumed"] += calories
    d["protein_consumed"]  += macros["protein"]
    d["carbs_consumed"]    += macros["carbs"]
    d["fat_consumed"]      += macros["fat"]
    d["fibre_consumed"]    += macros["fibre"]
    d["next_meal_id"]       = meal_id + 1
    session["dashboard"]   = d
    session.modified        = True

    return jsonify({"success": True, "meal": new_meal, "dashboard": d})


@app.route("/api/dashboard/delete_meal/<int:meal_id>", methods=["DELETE"])
def dashboard_delete_meal(meal_id):
    """Remove a meal by ID and subtract its macros from totals."""
    _init_dashboard_session()
    d      = dict(session["dashboard"])
    target = next((m for m in d["meals_list"] if m["id"] == meal_id), None)
    if not target:
        return jsonify({"error": f"Meal id {meal_id} not found"}), 404

    d["meals_list"]        = [m for m in d["meals_list"] if m["id"] != meal_id]
    d["calories_consumed"] = max(0, d["calories_consumed"] - target["calories"])
    d["protein_consumed"]  = max(0, d["protein_consumed"]  - target.get("protein", 0))
    d["carbs_consumed"]    = max(0, d["carbs_consumed"]    - target.get("carbs", 0))
    d["fat_consumed"]      = max(0, d["fat_consumed"]      - target.get("fat", 0))
    d["fibre_consumed"]    = max(0, d["fibre_consumed"]    - target.get("fibre", 0))
    session["dashboard"]   = d
    session.modified        = True

    return jsonify({"success": True, "deleted_id": meal_id, "dashboard": d})


@app.route("/api/dashboard/add_water", methods=["POST"])
def dashboard_add_water():
    """Increment water_logged by 1 (capped at goal)."""
    _init_dashboard_session()
    d = dict(session["dashboard"])
    if d["water_logged"] < d["water_goal"]:
        d["water_logged"] += 1
    session["dashboard"] = d
    session.modified      = True
    return jsonify({"success": True, "water_logged": d["water_logged"], "water_goal": d["water_goal"]})


@app.route("/api/dashboard/update_steps", methods=["POST"])
def dashboard_update_steps():
    """Update steps_logged with a new count."""
    _init_dashboard_session()
    data = request.get_json(force=True)
    try:
        steps = int(data.get("steps", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "steps must be a number"}), 400
    if steps < 0:
        return jsonify({"error": "Steps must be >= 0"}), 400
    d = dict(session["dashboard"])
    d["steps_logged"]    = steps
    session["dashboard"] = d
    session.modified      = True
    return jsonify({"success": True, "steps_logged": steps, "steps_goal": d["steps_goal"]})


# ---------------------------------------------------------------------------
# Routes — AI API
# ---------------------------------------------------------------------------

@app.route("/api/chat", methods=["POST"])
def chat():
    """Main conversational chat endpoint."""
    data = request.get_json(force=True)
    user_message  = data.get("message", "").strip()
    user_profile  = data.get("profile", {})
    history       = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Enrich system prompt with current profile
    profile_context = _build_profile_context(user_profile)
    system = AGENT_INSTRUCTIONS + "\n\n## CURRENT USER PROFILE\n" + profile_context

    response = call_watsonx(system, history, user_message)

    return jsonify({
        "response":  response,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    """Generate a full-day personalised meal plan."""
    data         = request.get_json(force=True)
    user_profile = data.get("profile", {})
    preferences  = data.get("preferences", {})

    profile_context = _build_profile_context(user_profile)
    pref_text = json.dumps(preferences, indent=2) if preferences else "None specified"

    user_message = f"""
Generate a COMPLETE personalised meal plan for today based on the following profile and preferences.
Follow ALL meal plan generation rules strictly.

User Preferences for this plan:
{pref_text}
"""
    system = AGENT_INSTRUCTIONS + "\n\n## CURRENT USER PROFILE\n" + profile_context
    response = call_watsonx(system, [], user_message)

    return jsonify({
        "meal_plan": response,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/yoga-routine", methods=["POST"])
def yoga_routine():
    """Generate a targeted yoga routine."""
    data         = request.get_json(force=True)
    profile_type = data.get("profile_type", "Beginners")
    duration     = data.get("duration", 30)
    focus        = data.get("focus", "General Wellness")
    user_profile = data.get("profile", {})

    profile_context = _build_profile_context(user_profile)

    user_message = f"""
Create a complete {duration}-minute yoga routine for: {profile_type}
Focus area: {focus}
Follow ALL yoga routine builder rules strictly. Include warm-up, main sequence, and cool-down.
"""
    system = AGENT_INSTRUCTIONS + "\n\n## CURRENT USER PROFILE\n" + profile_context
    response = call_watsonx(system, [], user_message)

    return jsonify({
        "routine":   response,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/bmi", methods=["POST"])
def calculate_bmi():
    """Calculate BMI and return AI-powered health insights."""
    data   = request.get_json(force=True)
    weight = float(data.get("weight", 0))   # kg
    height = float(data.get("height", 0))   # cm
    age    = int(data.get("age", 25))
    gender = data.get("gender", "Not specified")
    user_profile = data.get("profile", {})

    if weight <= 0 or height <= 0:
        return jsonify({"error": "Invalid weight or height"}), 400

    height_m = height / 100
    bmi      = round(weight / (height_m ** 2), 1)

    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25.0:
        category = "Normal weight"
    elif bmi < 30.0:
        category = "Overweight"
    else:
        category = "Obese"

    # Ideal weight range (BMI 18.5–24.9)
    ideal_min = round(18.5 * height_m ** 2, 1)
    ideal_max = round(24.9 * height_m ** 2, 1)

    # BMR (Mifflin-St Jeor)
    if gender.lower() in ["male", "m"]:
        bmr = round(10 * weight + 6.25 * height - 5 * age + 5)
    else:
        bmr = round(10 * weight + 6.25 * height - 5 * age - 161)

    profile_context = _build_profile_context(user_profile)
    user_message = f"""
The user has the following stats:
- Weight: {weight} kg | Height: {height} cm | Age: {age} | Gender: {gender}
- BMI: {bmi} ({category})
- Ideal weight range: {ideal_min}–{ideal_max} kg
- BMR: {bmr} kcal/day

Provide a warm, personalised health insights summary covering:
1. What this BMI means for their specific profile.
2. Realistic, safe target weight and timeline.
3. Top 3 dietary changes to move toward ideal BMI.
4. Top 3 exercise/yoga recommendations.
5. Motivational closing message.
"""
    system = AGENT_INSTRUCTIONS + "\n\n## CURRENT USER PROFILE\n" + profile_context
    insights = call_watsonx(system, [], user_message)

    return jsonify({
        "bmi":        bmi,
        "category":   category,
        "ideal_min":  ideal_min,
        "ideal_max":  ideal_max,
        "bmr":        bmr,
        "insights":   insights,
        "timestamp":  datetime.utcnow().isoformat()
    })


@app.route("/api/analyze-image", methods=["POST"])
def analyze_image():
    """Analyze a meal photo or grocery label using multimodal reasoning."""
    data         = request.get_json(force=True)
    image_data   = data.get("image", "")     # base64 encoded
    description  = data.get("description", "")
    user_profile = data.get("profile", {})

    if not image_data and not description:
        return jsonify({"error": "Provide image or description"}), 400

    profile_context = _build_profile_context(user_profile)

    if description:
        user_message = f"""
The user has described their meal/food item as follows:
"{description}"

Perform a detailed nutritional analysis following ALL image analysis rules:
1. List identified ingredients
2. Estimate calories and macros (protein, carbs, fat, fibre, sodium)
3. Check against user allergies and health conditions
4. Flag any ⚠️ ALLERGEN or ❌ HEALTH RISK
5. Suggest healthier swaps or modifications
"""
    else:
        # For actual image processing — describe what we received
        user_message = f"""
The user has uploaded a food image/grocery label for nutritional analysis.
Based on typical Indian and global food patterns, perform a complete analysis following ALL image analysis rules.
Image data received: [Base64 image — {len(image_data)} chars]
If you cannot process the image directly, ask the user to describe what they see in the image.
"""

    system = AGENT_INSTRUCTIONS + "\n\n## CURRENT USER PROFILE\n" + profile_context
    response = call_watsonx(system, [], user_message)

    return jsonify({
        "analysis":  response,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    """Generate diet recommendations for all family members."""
    data    = request.get_json(force=True)
    members = data.get("members", [])   # list of member profiles

    if not members:
        return jsonify({"error": "No family members provided"}), 400

    members_text = json.dumps(members, indent=2)

    user_message = f"""
Generate personalised nutrition recommendations for the following family members.
For each member, provide:
1. Daily calorie target
2. Key nutritional priorities for their age/health profile
3. 3 best food choices for them today
4. 1 food to avoid
5. A motivational health tip

Family Members:
{members_text}

End with a "Family Shared Meal Idea" that works for everyone simultaneously.
"""
    response = call_watsonx(AGENT_INSTRUCTIONS, [], user_message)

    return jsonify({
        "family_plan": response,
        "timestamp":   datetime.utcnow().isoformat()
    })


@app.route("/api/nutrition-facts", methods=["POST"])
def nutrition_facts():
    """Get detailed nutrition facts for a specific food item."""
    data      = request.get_json(force=True)
    food_item = data.get("food", "").strip()
    quantity  = data.get("quantity", "100g")

    if not food_item:
        return jsonify({"error": "Food item required"}), 400

    user_message = f"""
Provide comprehensive nutritional facts for: {food_item} ({quantity})

Include:
1. Calories per serving
2. Macros: Protein, Carbohydrates, Fat, Fibre, Sugar
3. Key Micronutrients (top 5 vitamins/minerals)
4. Glycaemic Index (if applicable)
5. Health benefits (top 3)
6. Best time to eat and best food pairings
7. Who should avoid this food
8. Indian preparation methods that preserve nutrients
"""
    response = call_watsonx(AGENT_INSTRUCTIONS, [], user_message)

    return jsonify({
        "food":       food_item,
        "quantity":   quantity,
        "facts":      response,
        "timestamp":  datetime.utcnow().isoformat()
    })


@app.route("/api/calorie-counter", methods=["POST"])
def calorie_counter():
    """Estimate calories for a list of foods consumed."""
    data  = request.get_json(force=True)
    foods = data.get("foods", [])   # [{"name": "...", "quantity": "..."}]

    if not foods:
        return jsonify({"error": "Food list required"}), 400

    food_text = "\n".join([f"- {f.get('name','?')} ({f.get('quantity','1 serving')})" for f in foods])

    user_message = f"""
Calculate total calories and macros for this meal/food log:
{food_text}

Provide:
1. Per-item calorie and macro breakdown in a markdown table
2. Total calories and macros
3. Whether this is within healthy daily limits
4. Top suggestion to improve the nutritional balance
"""
    response = call_watsonx(AGENT_INSTRUCTIONS, [], user_message)

    return jsonify({
        "analysis":  response,
        "timestamp": datetime.utcnow().isoformat()
    })


# ---------------------------------------------------------------------------
# Helper — profile context builder
# ---------------------------------------------------------------------------
def _build_profile_context(profile: dict) -> str:
    if not profile:
        return "No profile provided — use general healthy adult defaults."

    lines = []
    mappings = {
        "name":        "Name",
        "age":         "Age",
        "gender":      "Gender",
        "weight":      "Weight (kg)",
        "height":      "Height (cm)",
        "goal":        "Fitness Goal",
        "diet_type":   "Diet Type",
        "allergies":   "Allergies",
        "conditions":  "Health Conditions",
        "activity":    "Activity Level",
        "language":    "Preferred Language",
        "cuisine":     "Cuisine Preference",
        "religion":    "Dietary Religious Restrictions",
    }
    for key, label in mappings.items():
        val = profile.get(key)
        if val:
            if isinstance(val, list):
                val = ", ".join(val)
            lines.append(f"- {label}: {val}")
    return "\n".join(lines) if lines else "No profile provided — use general healthy adult defaults."


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    logger.info("🚀 NutriGenius AI starting on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=debug)

import json


def run_cv_match(groq_client, model: str, load_skill, cv_text: str, job_offer_text: str) -> dict:
    """Compare un CV à une offre via le skill apex_cv_matcher, retourne le CvMatchResult parsé."""
    system_prompt = load_skill("apex_cv_matcher")
    user_prompt = f"CV :\n{cv_text}\n\nOFFRE D'EMPLOI :\n{job_offer_text}"

    response = groq_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=6000,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)

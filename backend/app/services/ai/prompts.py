from app.models import TemplateType

BASE_PROMPT = """You are an elite engineer conducting a code review.
Review the provided code focusing on {focus_area}.

You MUST respond strictly with a JSON object matching this exact schema:
{{
  "summary": "A 1-2 sentence overview of the code's posture regarding {focus_area}.",
  "issues": [
    {{
      "title": "Short title of the finding",
      "description": "Detailed explanation of the issue or improvement.",
      "evidence": "The exact code snippet or pattern that triggered this finding.",
      "severity": "critical" | "high" | "medium" | "low",
      "category": "{category}",
      "confidence": 0.95,
      "function_name": "Name of the function if applicable, else null",
      "line_start": 12,
      "line_end": 14,
      "recommendation": "How to fix this issue."
    }}
  ]
}}

If no issues are found, return an empty array for "issues".
"""

TEMPLATE_PROMPTS = {
    TemplateType.security: BASE_PROMPT.format(
        focus_area="security vulnerabilities, secrets, logic flaws, and tech debt",
        category="security"
    ),
    TemplateType.code_quality: BASE_PROMPT.format(
        focus_area="naming, complexity, duplication, dead code, and error handling",
        category="code_quality"
    ),
    TemplateType.performance: BASE_PROMPT.format(
        focus_area="N+1 queries, unnecessary re-renders, memory leaks, and blocking I/O",
        category="performance"
    ),
    TemplateType.tech_debt: BASE_PROMPT.format(
        focus_area="TODO/FIXME comments, deprecated APIs, missing types, and outdated patterns",
        category="tech_debt"
    ),
    TemplateType.architecture: BASE_PROMPT.format(
        focus_area="separation of concerns, dependency direction, and coupling",
        category="architecture"
    ),
}

def get_prompt_for_template(template_type: str | TemplateType, depth: str = "standard") -> str:
    # Convert string to enum if necessary
    if isinstance(template_type, str):
        try:
            template_enum = TemplateType(template_type)
        except ValueError:
            template_enum = TemplateType.security
    else:
        template_enum = template_type
        
    base = TEMPLATE_PROMPTS.get(template_enum, TEMPLATE_PROMPTS[TemplateType.security])
    
    depth_instructions = {
        "quick": "Perform a very fast, high-level scan. Only flag obvious, critical issues. Ignore minor nits.",
        "standard": "Perform a standard review. Balance thoroughness with pragmatism.",
        "thorough": "Perform a deep, exhaustive review. Be extremely pedantic and flag every possible edge case, minor nit, performance optimization, and architectural issue."
    }
    
    instruction = depth_instructions.get(depth, depth_instructions["standard"])
    return f"{base}\n\nREVIEW DEPTH: {instruction}\n"

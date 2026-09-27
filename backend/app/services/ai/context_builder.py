import os
from typing import List, Optional
import re
from app.models import FileModel

# We will approximate tokens as characters / 4
MAX_TOKENS = 30000 
MAX_CHARS = MAX_TOKENS * 4

# files we always want to include for context
ALWAYS_INCLUDE_FILES = {
    "package.json", 
    "tsconfig.json", 
    "pyproject.toml", 
    ".env.example", 
    ".env.local.example",
    "requirements.txt",
    "pom.xml",
    "build.gradle"
}

def extract_imports(content: str, language: str) -> List[str]:
    """Extremely naive import extractor to find related files."""
    imports = []
    if language in ["ts", "tsx", "js", "jsx"]:
        # import { foo } from './bar'
        matches = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', content)
        # require('./bar')
        matches += re.findall(r'require\([\'"]([^\'"]+)[\'"]\)', content)
        imports.extend(matches)
    elif language == "py":
        # from foo import bar
        matches = re.findall(r'from\s+([^\s]+)\s+import', content)
        # import foo
        matches += re.findall(r'^import\s+([^\s]+)', content, re.MULTILINE)
        imports.extend(matches)
        
    return imports

def resolve_import_path(import_path: str, current_file_path: str, all_files: List[FileModel]) -> Optional[FileModel]:
    # Very naive resolution
    # E.g. import './auth/session' from 'app/api/route.ts' -> 'app/api/auth/session.ts'
    # For now, just search by filename matches in the project
    
    parts = import_path.split("/")
    base_name = parts[-1]
    
    # Check for direct matches by basename (ignoring extension)
    for f in all_files:
        f_base = f.filename.split(".")[0]
        if f_base == base_name:
            return f
            
    return None

def build_context_for_file(
    target_file: FileModel,
    all_files: List[FileModel],
    project_root_dir: str
) -> str:
    # 1. Start with target file
    context = ""
    
    target_path = os.path.join(project_root_dir, target_file.path)
    try:
        with open(target_path, "r", encoding="utf-8") as df:
            content = df.read()
    except Exception:
        return ""
        
    if not content.strip():
        return ""
        
    context += f"Primary file to review:\nFile: {target_file.path}\n```{target_file.language}\n{content}\n```\n\n"
    
    chars_used = len(context)
    
    # 2. Add config files
    context += "--- Project Context ---\n\n"
    for f in all_files:
        if f.filename in ALWAYS_INCLUDE_FILES and f.id != target_file.id:
            try:
                with open(os.path.join(project_root_dir, f.path), "r", encoding="utf-8") as df:
                    c = df.read()
                    
                if chars_used + len(c) < MAX_CHARS:
                    context += f"Config file: {f.path}\n```\n{c}\n```\n\n"
                    chars_used += len(c)
            except:
                pass
                
    # 3. Add imported files
    imports = extract_imports(content, target_file.language)
    added_ids = {target_file.id}
    
    for imp in imports:
        related_file = resolve_import_path(imp, target_file.path, all_files)
        if related_file and related_file.id not in added_ids:
            try:
                with open(os.path.join(project_root_dir, related_file.path), "r", encoding="utf-8") as df:
                    c = df.read()
                    
                # If too large, just add signature or truncate
                if len(c) > 5000:
                    c = c[:5000] + "\n... (truncated)"
                    
                if chars_used + len(c) < MAX_CHARS:
                    context += f"Related dependency: {related_file.path}\n```{related_file.language}\n{c}\n```\n\n"
                    chars_used += len(c)
                    added_ids.add(related_file.id)
            except:
                pass
                
    return context

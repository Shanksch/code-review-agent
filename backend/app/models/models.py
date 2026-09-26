import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text, String
from sqlalchemy.dialects.postgresql import ENUM as pgEnum
from typing import Optional


# ──────────────────────────── Enums ────────────────────────────

class ReviewScope(str, enum.Enum):
    single_file = "single_file"
    multi_file = "multi_file"
    project = "project"

class TemplateType(str, enum.Enum):
    security = "security"
    performance = "performance"
    code_quality = "code_quality"
    tech_debt = "tech_debt"
    architecture = "architecture"

class SeverityLevel(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"

    @property
    def rank(self) -> int:
        return {"critical": 4, "high": 3, "medium": 2, "low": 1}[self.value]

class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"

# ──────────────────────────── Link table ────────────────────────────

class ReviewFile(SQLModel, table=True):
    __tablename__ = "review_files"

    review_id: UUID = Field(foreign_key="reviews.id", primary_key=True)
    file_id: UUID = Field(foreign_key="files.id", primary_key=True)

# ──────────────────────────── AI Provider Config ────────────────────────────

class AiProviderConfig(SQLModel, table=True):
    __tablename__ = "ai_provider_configs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    name: str
    base_url: str
    api_key: str = Field(default="")
    model_name: str
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    projects: list["Project"] = Relationship(back_populates="ai_provider_config")

# ──────────────────────────── Project ────────────────────────────

class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    ai_provider_config_id: Optional[UUID] = Field(
        default=None, foreign_key="ai_provider_configs.id"
    )
    name: str
    description: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    ai_provider_config: Optional[AiProviderConfig] = Relationship(
        back_populates="projects"
    )
    files: list["FileModel"] = Relationship(back_populates="project")
    reviews: list["Review"] = Relationship(back_populates="project")
    chat_session: Optional["ChatSession"] = Relationship(back_populates="project")

# ──────────────────────────── File ────────────────────────────

class FileModel(SQLModel, table=True):
    __tablename__ = "files"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="projects.id", index=True)
    path: str
    filename: str
    language: str = Field(default="")
    size_bytes: int = Field(default=0)
    content: str = Field(default="", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="files")
    issues: list["Issue"] = Relationship(back_populates="file")

# ──────────────────────────── Review ────────────────────────────

class Review(SQLModel, table=True):
    __tablename__ = "reviews"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="projects.id", index=True)
    user_id: UUID
    scope: ReviewScope = Field(sa_column=Column(String))
    template_type: TemplateType = Field(sa_column=Column(String))
    summary: str = Field(default="")
    status: str = Field(default="pending")
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="reviews")
    issues: list["Issue"] = Relationship(back_populates="review")

# ──────────────────────────── Issue ────────────────────────────

class Issue(SQLModel, table=True):
    __tablename__ = "issues"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    review_id: UUID = Field(foreign_key="reviews.id", index=True)
    file_id: Optional[UUID] = Field(default=None, foreign_key="files.id")
    title: str
    description: str = Field(default="")
    severity: SeverityLevel = Field(sa_column=Column(String))
    function_name: Optional[str] = Field(default=None)
    line_start: Optional[int] = Field(default=None)
    line_end: Optional[int] = Field(default=None)
    recommendation: str = Field(default="")
    command_slug: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    review: Optional[Review] = Relationship(back_populates="issues")
    file: Optional[FileModel] = Relationship(back_populates="issues")

# ──────────────────────────── Chat Session ────────────────────────────

class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="projects.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="chat_session")
    messages: list["ChatMessage"] = Relationship(back_populates="session")

# ──────────────────────────── Chat Message ────────────────────────────

class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="chat_sessions.id", index=True)
    role: ChatRole = Field(sa_column=Column(String))
    content: str = Field(sa_column=Column(Text))
    issue_id: Optional[UUID] = Field(default=None, foreign_key="issues.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: Optional[ChatSession] = Relationship(back_populates="messages")

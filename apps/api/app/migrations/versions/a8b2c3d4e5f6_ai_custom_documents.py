"""Add ai_custom_documents table for RAG custom_doc source.

Revision ID: a8b2c3d4e5f6
Revises: f7a1b234c5d9
Create Date: 2026-05-14 15:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a8b2c3d4e5f6"
down_revision = "f7a1b234c5d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_custom_documents",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "master_id",
            sa.Integer,
            sa.ForeignKey("masters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(300), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("s3_key", sa.String(500), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("pages_count", sa.Integer, nullable=True),
        sa.Column("chars_count", sa.Integer, nullable=True),
        sa.Column(
            "chunks_count",
            sa.Integer,
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ai_custom_documents_master_id",
        "ai_custom_documents",
        ["master_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_custom_documents_master_id",
        table_name="ai_custom_documents",
    )
    op.drop_table("ai_custom_documents")

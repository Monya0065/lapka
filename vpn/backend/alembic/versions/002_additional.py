"""Additional tables

Revision ID: 002_additional
Revises: 001_initial
Create Date: 2026-04-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_additional'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str]], None = None
depends_on: Union[str, Sequence[str]], None = None


def upgrade() -> None:
    op.create_table(
        'uploaded_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('filename', sa.String(255)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_uploaded_configs_user_id', 'uploaded_configs', ['user_id'])

    op.create_table(
        'push_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('token', sa.String(512)),
        sa.Column('device_type', sa.String(20)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_push_tokens_user_id', 'push_tokens', ['user_id'])
    op.create_index('ix_push_tokens_token', 'push_tokens', ['token'], unique=True)

    op.create_table(
        'blacklist',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ip', sa.String(45)),
        sa.Column('reason', sa.String(255)),
        sa.Column('blocked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_blacklist_ip', 'blacklist', ['ip'], unique=True)
    op.create_index('ix_blacklist_expires_at', 'blacklist', ['expires_at'])

    op.create_table(
        'admin_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('action', sa.String(50)),
        sa.Column('target_type', sa.String(50)),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('ip', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_admin_audit_logs_admin_id', 'admin_audit_logs', ['admin_id'])
    op.create_index('ix_admin_audit_logs_created_at', 'admin_audit_logs', ['created_at'])

    op.add_column('users', sa.Column('email_verified', sa.Boolean(), server_default='false'))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default='0'))

    op.execute("ALTER TABLE users ADD CONSTRAINT check_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')")


def downgrade() -> None:
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'email_verified')
    op.drop_table('admin_audit_logs')
    op.drop_table('blacklist')
    op.drop_table('push_tokens')
    op.drop_table('uploaded_configs')
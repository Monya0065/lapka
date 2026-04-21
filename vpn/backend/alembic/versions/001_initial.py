"""Initial tables

Revision ID: 001_initial
Revises: 
Create Date: 2026-04-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('mfa_enabled', sa.Boolean(), default=False),
        sa.Column('role', sa.String(20), default='user'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('refresh_hash', sa.String(255)),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])

    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('plan_id', sa.String(50)),
        sa.Column('provider', sa.String(50)),
        sa.Column('status', sa.String(20), default='trial'),
        sa.Column('renew_at', sa.DateTime(), nullable=True),
        sa.Column('grace_until', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])

    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscriptions.id')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('provider', sa.String(50)),
        sa.Column('order_id', sa.String(255)),
        sa.Column('amount', sa.Integer()),
        sa.Column('status', sa.String(20)),
        sa.Column('idempotency_key', sa.String(255), unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_payments_user_id', 'payments', ['user_id'])
    op.create_index('ix_payments_order_id', 'payments', ['order_id'])

    op.create_table(
        'payment_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('provider', sa.String(50)),
        sa.Column('event_id', sa.String(255)),
        sa.Column('event_hash', sa.String(255)),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_payment_events_provider_event_id', 'payment_events', ['provider', 'event_id'])

    op.create_table(
        'devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('platform', sa.String(20)),
        sa.Column('fingerprint_hash', sa.String(255)),
        sa.Column('name', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), default='pending_claim'),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_devices_user_id', 'devices', ['user_id'])

    op.create_table(
        'telegram_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('telegram_user_id', sa.String(50)),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('last_nonce', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_telegram_links_user_id', 'telegram_links', ['user_id'])
    op.create_index('ix_telegram_links_telegram_user_id', 'telegram_links', ['telegram_user_id'])

    op.create_table(
        'device_claim_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('token_hash', sa.String(255)),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_device_claim_tokens_user_id', 'device_claim_tokens', ['user_id'])

    op.create_table(
        'vpn_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id')),
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('public_key', sa.String(255)),
        sa.Column('config_ref', sa.String(255)),
        sa.Column('status', sa.String(20), default='draft'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_vpn_profiles_user_id', 'vpn_profiles', ['user_id'])
    op.create_index('ix_vpn_profiles_device_id', 'vpn_profiles', ['device_id'])

    op.create_table(
        'vpn_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('region', sa.String(20)),
        sa.Column('endpoint', sa.String(255)),
        sa.Column('public_key', sa.String(255)),
        sa.Column('status', sa.String(20), default='active'),
        sa.Column('capacity', sa.Integer(), default=100),
        sa.Column('health_score', sa.Integer(), default=100),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_vpn_nodes_region', 'vpn_nodes', ['region'])

    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(50)),
        sa.Column('entity', sa.String(50)),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('payload_hash', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_events_actor_id', 'audit_events', ['actor_id'])
    op.create_index('ix_audit_events_entity', 'audit_events', ['entity', 'entity_id'])


def downgrade() -> None:
    op.drop_table('audit_events')
    op.drop_table('vpn_nodes')
    op.drop_table('vpn_profiles')
    op.drop_table('device_claim_tokens')
    op.drop_table('telegram_links')
    op.drop_table('devices')
    op.drop_table('payment_events')
    op.drop_table('payments')
    op.drop_table('subscriptions')
    op.drop_table('sessions')
    op.drop_table('users')
"""Initial schema with PostGIS

Revision ID: d2f13393badb
Revises: 
Create Date: 2026-09-06 10:28:46.425974

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'd2f13393badb'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Initialize PostGIS
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # conversation_threads
    op.create_table(
        'conversation_threads',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('thread_id', sa.String(), nullable=False),
        sa.Column('context_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('schema_version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversation_threads_thread_id'), 'conversation_threads', ['thread_id'], unique=True)

    # runs
    op.create_table(
        'runs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('thread_id', sa.String(), nullable=False),
        sa.Column('run_status', sa.Enum('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', name='runstatus'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(['thread_id'], ['conversation_threads.thread_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # evidence_items
    op.create_table(
        'evidence_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('extracted_entities', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # map_layers
    op.create_table(
        'map_layers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('layer_type', sa.String(), nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='GEOMETRY', srid=4326, from_text='ST_GeomFromEWKT', name='geometry', nullable=False)),
        sa.Column('properties', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # connector_snapshots
    op.create_table(
        'connector_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_name', sa.String(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('validity_window', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_connector_snapshots_source_name'), 'connector_snapshots', ['source_name'], unique=False)

    # connector_status
    op.create_table(
        'connector_status',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_name', sa.String(), nullable=False),
        sa.Column('is_online', sa.Boolean(), nullable=False),
        sa.Column('last_checked', sa.DateTime(timezone=True), nullable=False),
        sa.Column('error_state', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_connector_status_source_name'), 'connector_status', ['source_name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_connector_status_source_name'), table_name='connector_status')
    op.drop_table('connector_status')
    
    op.drop_index(op.f('ix_connector_snapshots_source_name'), table_name='connector_snapshots')
    op.drop_table('connector_snapshots')
    
    op.drop_table('map_layers')
    op.drop_table('evidence_items')
    op.drop_table('runs')
    
    op.drop_index(op.f('ix_conversation_threads_thread_id'), table_name='conversation_threads')
    op.drop_table('conversation_threads')
    
    op.execute("DROP TYPE IF EXISTS runstatus")

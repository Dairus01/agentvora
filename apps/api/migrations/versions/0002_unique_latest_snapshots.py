"""Keep one latest cached snapshot per symbol; preserve research/trade records."""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    snapshots = sa.table(
        "market_snapshots",
        sa.column("id", sa.String),
        sa.column("symbol", sa.String),
        sa.column("timestamp", sa.String),
    )
    rows = conn.execute(
        sa.select(snapshots.c.id, snapshots.c.symbol).order_by(
            snapshots.c.timestamp.desc(), snapshots.c.id.desc()
        )
    ).all()
    seen = set()
    for ident, symbol in rows:
        if symbol in seen:
            conn.execute(snapshots.delete().where(snapshots.c.id == ident))
        else:
            seen.add(symbol)
    op.drop_index("ix_market_snapshots_symbol", table_name="market_snapshots")
    op.create_index(
        "ix_market_snapshots_symbol", "market_snapshots", ["symbol"], unique=True
    )


def downgrade():
    op.drop_index("ix_market_snapshots_symbol", table_name="market_snapshots")
    op.create_index(
        "ix_market_snapshots_symbol", "market_snapshots", ["symbol"], unique=False
    )

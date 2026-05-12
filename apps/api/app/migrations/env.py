"""
Alembic migration environment.
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.core.database import Base
from app.core.config import settings

# Import all models so Base.metadata knows about them
from app.modules.auth.models import Identity  # noqa
from app.modules.core.models import FeatureFlags  # noqa
from app.modules.masters.models import Master, MasterLocation  # noqa
from app.modules.clients.models import Client, ClientMasterLink  # noqa
from app.modules.services.models import Service  # noqa
from app.modules.booking.models import ScheduleTemplate, BlockedSlot, Appointment  # noqa
from app.modules.booking.noshow_models import ClientNoShowLog  # noqa
from app.modules.payments.models import Payment, MasterSubscription, ClientSubscription  # noqa
from app.modules.promo.models import Promotion, PromoUsage  # noqa
from app.modules.loyalty.models import LoyaltyAccount, LoyaltyTransaction, Referral  # noqa
from app.modules.waitlist.models import WaitlistEntry  # noqa
from app.modules.reviews.models import ClientReview  # noqa
from app.modules.ai.models import AIKnowledgeChunk, AIConversation, VoiceSession  # noqa
from app.modules.portfolio.models import WorkPhoto  # noqa
from app.modules.support.models import SupportTicket, TicketMessage  # noqa
from app.modules.marketplace.models import MarketplaceListing  # noqa
from app.modules.superadmin.models import AdminAuditLog  # noqa

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

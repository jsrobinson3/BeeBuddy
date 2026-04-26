"""Unit tests for Share model enum binding (no DB required).

Regression test for Sentry issue BEEBUDDY-BACKEND-13:
``InvalidTextRepresentationError: invalid input value for enum share_status: "PENDING"``

The Postgres enum types ``share_status`` and ``share_role`` store the
lowercase ``.value`` of the corresponding StrEnum (see migration
a080fea34fe1). Without ``values_callable``, SQLAlchemy binds ``.name``
(uppercase), causing every query that filters on these enums to fail.
"""

from sqlalchemy.dialects import postgresql

from app.models.share import Share, ShareRole, ShareStatus


def test_share_status_binds_lowercase_value():
    col = Share.__table__.c.status
    proc = col.type.bind_processor(postgresql.asyncpg.dialect())
    assert proc is not None
    for member in ShareStatus:
        assert proc(member) == member.value, (
            f"Expected {member!r} to bind to {member.value!r} but got {proc(member)!r}"
        )


def test_share_role_binds_lowercase_value():
    col = Share.__table__.c.role
    proc = col.type.bind_processor(postgresql.asyncpg.dialect())
    assert proc is not None
    for member in ShareRole:
        assert proc(member) == member.value, (
            f"Expected {member!r} to bind to {member.value!r} but got {proc(member)!r}"
        )


def test_share_enum_columns_know_their_python_class():
    """Without an enum_class, result rows come back as plain strings, breaking
    callers that rely on enum semantics (e.g. ``Permission(share.role)``)."""
    assert Share.__table__.c.status.type.enum_class is ShareStatus
    assert Share.__table__.c.role.type.enum_class is ShareRole

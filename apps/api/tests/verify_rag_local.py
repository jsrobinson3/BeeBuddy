"""Quick local RAG verification — tests the full pipeline end-to-end.

Run with: cd apps/api && uv run python tests/verify_rag_local.py

Requires: Postgres with knowledge_chunks loaded, Ollama running.
"""

import asyncio
import sys
from pathlib import Path

# Ensure app is importable when running directly
sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Direct RAG search test ────────────────────────────────────────────────


async def test_rag_search():
    """Verify RAG retrieval returns relevant chunks."""
    from app.db.session import AsyncSessionLocal
    from app.services import knowledge_service, rag_service

    async with AsyncSessionLocal() as db:
        count = await knowledge_service.chunk_count(db)
        print(f"\n{'=' * 60}")
        print(f"  Knowledge base: {count:,} chunks loaded")
        print(f"{'=' * 60}")

        if count == 0:
            print("  FAIL: No chunks in database. Load the seed first.")
            return False

        queries = [
            "best varroa mite treatment in fall",
            "how to requeen a hive",
            "signs of American foulbrood",
        ]

        all_passed = True
        for query in queries:
            results = await rag_service.search(db, query)
            top_score = results[0]["similarity"] if results else 0
            status = "PASS" if len(results) > 0 and top_score > 0.5 else "FAIL"
            if status == "FAIL":
                all_passed = False
            print(f"\n  [{status}] \"{query}\"")
            print(f"    Results: {len(results)}, Top similarity: {top_score:.3f}")
            if results:
                print(f"    Best chunk: {results[0]['content'][:100]}...")

        return all_passed


# ── MCP tool test ─────────────────────────────────────────────────────────


async def test_mcp_tool():
    """Verify the search_knowledge_base MCP tool works."""
    import uuid

    from app.db.session import AsyncSessionLocal
    from app.services.mcp_tools import create_mcp_server

    fake_user_id = uuid.uuid4()

    async with AsyncSessionLocal() as db:
        server = create_mcp_server(db, fake_user_id)
        tools = await server.list_tools()
        tool_names = [t.name for t in tools]

        has_kb = "search_knowledge_base" in tool_names
        status = "PASS" if has_kb else "FAIL"
        print(f"\n  [{status}] search_knowledge_base tool registered")
        print(f"    Available tools: {len(tool_names)}")

        if has_kb:
            result = await server.call_tool(
                "search_knowledge_base",
                {"query": "varroa treatment", "limit": 3},
            )
            content = str(result)
            has_results = "content" in content
            status = "PASS" if has_results else "FAIL"
            print(f"  [{status}] Tool returns results")
            if has_results:
                print(f"    Response preview: {content[:200]}...")

        return has_kb


# ── Main ──────────────────────────────────────────────────────────────────


async def main():
    print("\n  RAG Local Verification")
    print("  " + "-" * 40)

    search_ok = await test_rag_search()
    tool_ok = await test_mcp_tool()

    print(f"\n{'=' * 60}")
    if search_ok and tool_ok:
        print("  ALL TESTS PASSED — RAG is working end-to-end")
    else:
        print("  SOME TESTS FAILED — check output above")
    print(f"{'=' * 60}\n")

    return 0 if (search_ok and tool_ok) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

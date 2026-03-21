"""Shared constants for the guardrails pipeline.

Domain keywords, filler phrases, injection patterns, PII regexes,
and canned responses used by the style and topic guards.
"""

import re

# ---------------------------------------------------------------------------
# Beekeeping domain keywords — used for topic relevance classification.
# Frozen set for O(1) lookup.  Includes common misspellings/abbreviations.
# ---------------------------------------------------------------------------

DOMAIN_KEYWORDS: frozenset[str] = frozenset({
    # Core concepts
    "bee", "bees", "beehive", "beehives", "beekeeping", "beekeeper",
    "beekeepers", "apiary", "apiaries", "apiculture", "apiarist",
    "colony", "colonies", "swarm", "swarms", "swarming",
    "hive", "hives", "super", "supers", "brood", "comb", "combs",
    "honeycomb", "wax", "beeswax", "propolis", "pollen",
    # Bee types
    "queen", "worker", "drone", "nuc", "nucs", "nucleus", "package",
    "italian", "carniolan", "buckfast", "russian", "caucasian",
    "africanized", "saskatraz",
    # Hive types / equipment
    "langstroth", "top-bar", "topbar", "warre", "flow",
    "frame", "frames", "foundation", "foundationless",
    "smoker", "veil", "suit", "gloves", "hive tool", "extractor",
    "uncapping", "excluder", "feeder", "entrance reducer",
    "bottom board", "inner cover", "outer cover", "telescoping",
    # Products
    "honey", "honeydew", "nectar", "royal jelly", "bee bread",
    "mead", "beeswax candle", "comb honey", "cut comb",
    "creamed honey", "raw honey", "extracted honey",
    # Health & pests
    "varroa", "mite", "mites", "nosema", "foulbrood", "afb", "efb",
    "chalkbrood", "sacbrood", "deformed wing", "dwv",
    "small hive beetle", "shb", "wax moth", "tracheal",
    "pesticide", "neonicotinoid", "ccd", "colony collapse",
    "robbing", "absconding", "queenless", "laying worker",
    "european foulbrood", "american foulbrood",
    # Treatments
    "oxalic", "formic", "thymol", "apivar", "apiguard", "mite-away",
    "apistan", "checkmite", "hopguard", "amitraz",
    "alcohol wash", "sugar roll", "mite count", "ipm",
    "integrated pest management",
    # Management
    "inspection", "inspections", "inspect", "harvest", "harvesting",
    "split", "splits", "splitting", "requeen", "requeening",
    "combine", "combining", "feeding", "sugar syrup", "fondant",
    "pollen patty", "overwintering", "winterizing", "ventilation",
    "moisture", "insulation", "wrapping",
    "spring buildup", "fall prep", "nectar flow", "dearth",
    "orientation flight", "cleansing flight", "bearding",
    # Anatomy / biology
    "proboscis", "mandible", "thorax", "abdomen", "stinger",
    "waggle dance", "pheromone", "brood pattern", "capped brood",
    "larvae", "larva", "pupae", "pupa", "egg", "eggs",
    "laying", "mated", "unmated", "virgin queen", "supersedure",
    "emergency cell", "queen cell", "swarm cell",
    # Flora
    "pollinator", "pollinators", "pollination", "forage", "foraging",
    "clover", "wildflower", "dandelion", "goldenrod", "aster",
    "tupelo", "manuka", "acacia", "lavender", "sunflower",
    "basswood", "linden", "eucalyptus", "citrus",
    # Organizations / resources
    "extension", "bee club", "bee association",
    "coloss", "bip", "bee informed",
    # Seasons / timing / environment
    "spring", "summer", "fall", "autumn", "winter",
    "overwintered", "wintered", "dwindled",
    "weather", "temperature", "rain", "wind", "frost", "freeze",
    "humidity", "climate", "forecast", "cold snap", "heat wave",
    # App-specific
    "beebuddy", "buddy", "apiary", "cadence", "cadences",
    "task", "tasks",
})

# ---------------------------------------------------------------------------
# Conversational patterns — always allowed regardless of topic
# ---------------------------------------------------------------------------

CONVERSATIONAL_PATTERNS: list[re.Pattern] = [
    re.compile(r"^(hi|hey|hello|howdy|yo|sup|good\s*(morning|afternoon|evening))[\s!.?]*$", re.I),
    re.compile(r"^(thanks?|thank\s*you|thx|ty|cheers|appreciate)[\s!.]*$", re.I),
    re.compile(r"^(bye|goodbye|see\s*ya|later|ttyl|good\s*night)[\s!.?]*$", re.I),
    re.compile(r"^(yes|no|yep|nope|yeah|nah|ok|okay|sure|got it|makes sense)[\s!.?]*$", re.I),
    re.compile(r"^(what|who)\s+(are|can)\s+(you|u)\b", re.I),
    re.compile(r"^(help|help me|what can you do)[\s!.?]*$", re.I),
]

# ---------------------------------------------------------------------------
# Prompt injection patterns — never reveal detection to the user
# ---------------------------------------------------------------------------

INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)", re.I),
    re.compile(r"ignore\s+(everything\s+)?(above|before|prior)", re.I),
    re.compile(r"ignore\s+your\s+(instructions?|prompts?|rules?|programming)", re.I),
    re.compile(
        r"forget\s+(everything|all|what)\s+(above|before|prior|you)", re.I,
    ),
    re.compile(
        r"disregard\s+(all\s+)?(previous\s+)?(instructions?|prompts?|rules?)", re.I,
    ),
    re.compile(r"you\s+are\s+now\s+(a|an|my)\s+", re.I),
    re.compile(r"(pretend|act)\s+(like\s+)?(you'?re|to\s+be|you\s+are)\s+", re.I),
    re.compile(r"act\s+as\s+(a|an|my)\s+(?!bee|hive|apiary)", re.I),
    re.compile(r"(new|override|bypass|disable)\s+(system\s+)?(instructions?|rules?|prompt)", re.I),
    re.compile(
        r"(reveal|tell|give)\s+(me\s+)?(your|the)\s+(system\s+)?"
        r"(prompt|instructions?)", re.I,
    ),
    re.compile(
        r"(print|show|display|output|repeat)\s+(your|the)\s+"
        r"(system\s+)?(prompt|instructions?)", re.I,
    ),
    re.compile(r"from\s+now\s+on[\s,]+(you|act|behave|respond)", re.I),
    re.compile(r"(jailbreak|do\s+anything\s+now|dan\s+mode)", re.I),
    re.compile(r"\[\s*(system|SYSTEM)\s*\]", re.I),
    re.compile(r"<\s*(system|SYSTEM)\s*>", re.I),
]

# ---------------------------------------------------------------------------
# PII patterns — block messages containing sensitive personal info
# ---------------------------------------------------------------------------

PII_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b"),          # SSN
    re.compile(r"\b(?:\d[ -]*){13,16}\b"),                       # Credit card
    # US phone number
    re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
]

# ---------------------------------------------------------------------------
# Filler phrases — tiered severity
# ---------------------------------------------------------------------------

# Always-filler: true filler that never adds value
FILLER_ALWAYS: frozenset[str] = frozenset({
    "needless to say",
    "it goes without saying",
    "at the end of the day",
    "as a matter of fact",
    "the fact of the matter is",
    "in point of fact",
    "when all is said and done",
    "all things considered",
    "by and large",
    "for all intents and purposes",
    "it should be noted that",
    "it is worth noting that",
    "it is worth mentioning that",
    "as previously mentioned",
    "as i mentioned earlier",
})

# Contextual filler: emphasis/safety cues that CAN be valuable in concise
# responses.  Only counted when the response already exceeds the word limit.
FILLER_CONTEXTUAL: frozenset[str] = frozenset({
    "remember that",
    "keep in mind that",
    "it's important to note",
    "it's crucial to",
    "it's essential to",
    "it's important to remember",
    "please note that",
    "bear in mind that",
    "it's worth keeping in mind",
    "do keep in mind",
    "make sure to",
    "be sure to",
    "don't forget to",
    "you should also consider",
    "another thing to consider is",
    "one thing to keep in mind is",
    "it's also worth noting",
    "additionally, it's important",
    "i would also recommend",
    "i would also suggest",
})

# ---------------------------------------------------------------------------
# Question-type classification keywords
# ---------------------------------------------------------------------------

YES_NO_STARTERS: frozenset[str] = frozenset({
    "is", "are", "was", "were", "do", "does", "did", "can", "could",
    "should", "would", "will", "has", "have", "had", "am",
})

HOW_TO_PATTERNS: list[re.Pattern] = [
    re.compile(r"^how\s+(do|can|should|would|to)\b", re.I),
    re.compile(r"^what('?s|\s+is)\s+the\s+best\s+way\s+to\b", re.I),
    re.compile(r"^(steps?|guide|walk\s*through)\s+(to|for)\b", re.I),
]

# ---------------------------------------------------------------------------
# Canned responses
# ---------------------------------------------------------------------------

RESPONSE_OFF_TOPIC = (
    "I'm Buddy, your beekeeping assistant! I'm best at helping with "
    "hive management, bee health, inspections, harvests, and everything "
    "apiculture. What can I help you with today?"
)

RESPONSE_PII_DETECTED = (
    "It looks like your message contains sensitive personal information. "
    "For your privacy, I can't process messages with things like social "
    "security numbers, credit card numbers, or phone numbers. Please "
    "remove that info and try again."
)

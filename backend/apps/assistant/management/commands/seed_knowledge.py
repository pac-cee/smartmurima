"""Seed the RAG knowledge base with sample RAB/MINAGRI agronomic guidance.

In production, point ``--dir`` at a folder of .txt/.md documents. Without a
directory it loads a small built-in corpus so the assistant works out of the box.
"""
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.assistant.services import KnowledgeService

BUILTIN_DOCS = [
    # ---- Irrigation & soil moisture (semi-arid Bugesera) -----------------
    {
        "title": "Maize irrigation scheduling for Bugesera",
        "source": "rab_maize_irrigation",
        "content": (
            "Maize is most sensitive to water stress during tasselling, silking and "
            "grain filling; water deficit at flowering is the single largest cause "
            "of yield loss. Irrigate when soil moisture in the 0-30 cm root zone "
            "falls below about 25% volumetric water content. In Bugesera's dry "
            "spells (June-September and short dry periods in January-February), "
            "apply 20-30 mm per irrigation and avoid waterlogging, which starves "
            "roots of oxygen. Reduce irrigation as the crop reaches physiological "
            "maturity (black layer on the kernel). Mulching with crop residues "
            "conserves soil moisture and lowers irrigation frequency on the sandy "
            "soils common in Bugesera."
        ),
    },
    {
        "title": "Soil moisture thresholds and monitoring",
        "source": "rab_soil_moisture",
        "content": (
            "Place soil-moisture sensors in the active root zone (10-30 cm for most "
            "annual crops). Interpret volumetric water content as follows: below "
            "20% indicates severe water stress and immediate irrigation is advised; "
            "20-30% indicates moderate stress where irrigation should be planned "
            "within one to two days; above 30% is generally adequate for most crops. "
            "Sandy Bugesera soils drain quickly and reach stress faster than loam or "
            "clay soils, so check them more often. Contour bunds, tied ridges and "
            "mulching improve rainwater infiltration and retention."
        ),
    },
    {
        "title": "Bean and vegetable irrigation guidance",
        "source": "rab_bean_irrigation",
        "content": (
            "Beans are shallow-rooted and sensitive to both drought and "
            "waterlogging. Keep soil moisture above 25% during flowering and pod "
            "filling, the critical stages for yield. Apply light, frequent "
            "irrigation of 15-20 mm rather than heavy flooding. Avoid wetting the "
            "foliage late in the day, since prolonged leaf wetness encourages rust "
            "and angular leaf spot. Stop irrigation as pods dry down for harvest."
        ),
    },
    {
        "title": "Irish potato water management",
        "source": "rab_potato_irrigation",
        "content": (
            "Irish potato needs steady soil moisture, especially from tuber "
            "initiation through bulking. Keep the root zone between 60% and 80% of "
            "field capacity; irregular watering causes tuber cracking and "
            "second-growth. In warmer low-altitude parts of Bugesera, irrigate to "
            "prevent the soil drying below 30% moisture. Ridging keeps tubers "
            "covered and reduces greening. Ease off irrigation about two weeks "
            "before harvest to firm the skins."
        ),
    },
    {
        "title": "Cassava moisture and drought tolerance",
        "source": "rab_cassava_water",
        "content": (
            "Cassava is drought-tolerant and well suited to Bugesera's semi-arid "
            "conditions once established. It needs adequate moisture in the first "
            "three months after planting for good establishment and root "
            "development. After establishment it withstands long dry spells by "
            "shedding leaves. Avoid waterlogging, which causes root rot. Cassava is "
            "a valuable food-security crop because it can be left in the ground and "
            "harvested piecemeal during droughts."
        ),
    },
    # ---- Fertilizer / NPK guidance ---------------------------------------
    {
        "title": "Maize fertilizer and NPK guidance",
        "source": "rab_maize_fertilizer",
        "content": (
            "For maize, apply a compound fertilizer such as NPK 17-17-17 at planting "
            "at about 100-125 kg per hectare, placed near but not touching the seed. "
            "Top-dress with urea (about 50-100 kg per hectare) in two splits: at the "
            "knee-high stage (about 4-6 leaves) and just before tasselling, when "
            "nitrogen demand peaks. Incorporate well-decomposed manure or compost to "
            "improve the water-holding capacity of sandy soils. Apply nitrogen when "
            "soil is moist to reduce volatilisation losses."
        ),
    },
    {
        "title": "Bean fertilizer recommendations",
        "source": "minagri_bean_fertilizer",
        "content": (
            "Beans fix atmospheric nitrogen through rhizobia bacteria, so they need "
            "little nitrogen fertilizer. Apply a phosphorus-rich fertilizer such as "
            "DAP or NPK 17-17-17 at planting at about 50-100 kg per hectare to "
            "support nodulation and root growth. Avoid excess nitrogen, which "
            "produces leafy plants with few pods. Where seed is available, inoculate "
            "with rhizobium. Lime strongly acidic soils to raise pH toward 5.5-6.5, "
            "and add well-rotted manure to improve soil structure."
        ),
    },
    {
        "title": "Irish potato fertilizer program",
        "source": "rab_potato_fertilizer",
        "content": (
            "Irish potato is a heavy feeder, especially of potassium. Apply NPK "
            "17-17-17 at planting at 300-400 kg per hectare on fertile soils, or use "
            "a blend richer in potassium where available. Top-dress with urea at the "
            "earthing-up (ridging) stage to support canopy growth. Potassium "
            "improves tuber size and storage quality. Incorporate organic manure to "
            "boost yields and buffer soil moisture. Avoid over-application of "
            "nitrogen late in the season, which delays tuber maturity."
        ),
    },
    {
        "title": "Cassava fertilizer and soil fertility",
        "source": "rab_cassava_fertilizer",
        "content": (
            "Cassava tolerates poor soils but responds well to modest fertilizer. "
            "Apply NPK 17-17-17 at about 100-150 kg per hectare within the first two "
            "months, split if possible. Potassium is important for root bulking. On "
            "very depleted Bugesera soils, combine mineral fertilizer with farmyard "
            "manure or compost. Practise crop rotation and intercropping with "
            "legumes such as beans or groundnuts to restore soil nitrogen."
        ),
    },
    {
        "title": "Using organic manure and compost",
        "source": "rab_organic_matter",
        "content": (
            "Organic matter is the foundation of soil fertility on Bugesera's sandy "
            "soils. Apply 5-10 tonnes per hectare of well-decomposed farmyard manure "
            "or compost before planting to raise water-holding capacity, improve "
            "structure and supply slow-release nutrients. Combine organic manure "
            "with mineral fertilizer (integrated soil fertility management) for the "
            "best and most affordable response. Compost pits and covered heaps "
            "reduce nutrient loss during Bugesera's hot, dry conditions."
        ),
    },
    # ---- Diseases: symptoms + management ---------------------------------
    {
        "title": "Maize leaf blight: symptoms and management",
        "source": "rab_maize_leaf_blight",
        "content": (
            "Northern and turcicum leaf blight of maize appear as long, cigar-shaped "
            "grey-green to tan lesions on the leaves that enlarge and merge, drying "
            "the leaf and reducing grain fill. It is worse in humid, cool conditions "
            "and where maize residues are left on the surface. Management: plant "
            "certified resistant or tolerant varieties, rotate with non-host crops "
            "such as beans, remove and destroy or bury infected residues, and apply "
            "a recommended fungicide when disease pressure is high and the crop is "
            "still in early growth. Avoid overhead irrigation late in the day."
        ),
    },
    {
        "title": "Bean rust: symptoms and management",
        "source": "rab_bean_rust",
        "content": (
            "Bean rust shows as small reddish-brown, powdery pustules mainly on the "
            "underside of leaves, often ringed by a yellow halo; severe infection "
            "causes early leaf drop and yield loss. It spreads rapidly in warm, "
            "humid, wet conditions. Management: grow resistant varieties, use wider "
            "spacing for airflow, avoid overhead irrigation, remove volunteer bean "
            "plants, and rotate crops. Where rust appears early and is spreading, "
            "apply a sulphur-based or recommended fungicide. Remove and destroy "
            "heavily infected debris after harvest."
        ),
    },
    {
        "title": "Cassava mosaic disease: symptoms and management",
        "source": "rab_cassava_mosaic",
        "content": (
            "Cassava mosaic disease is caused by viruses spread by whiteflies and by "
            "planting infected stem cuttings. Symptoms are yellow-green mottling, "
            "twisted and distorted leaves, stunting and poor root yield. Management: "
            "plant certified, disease-free, tolerant or resistant varieties; select "
            "cuttings only from healthy, symptom-free plants; uproot and destroy "
            "infected plants (roguing) as soon as they are seen; and control "
            "whitefly populations. Community-wide use of clean planting material is "
            "the most effective control."
        ),
    },
    {
        "title": "Potato late blight: symptoms and management",
        "source": "rab_potato_late_blight",
        "content": (
            "Late blight is the most destructive disease of Irish potato. It causes "
            "dark, water-soaked spots on leaves that rapidly enlarge into brown-black "
            "lesions, often with a white mould on the underside in wet weather, and "
            "can destroy a whole crop within days. It thrives in cool, wet, humid "
            "conditions. Management: plant certified clean seed of resistant "
            "varieties, ensure good drainage and spacing, hill soil over tubers, "
            "remove volunteers and cull piles, and apply protective fungicides on a "
            "schedule during humid weather. Remove and destroy infected haulms "
            "before harvest to protect the tubers."
        ),
    },
    {
        "title": "Bean anthracnose and angular leaf spot",
        "source": "rab_bean_foliar",
        "content": (
            "Anthracnose shows as dark sunken lesions on pods and stems and dark "
            "veins on leaf undersides; angular leaf spot produces angular brown "
            "patches bounded by leaf veins. Both are seed-borne and spread in wet "
            "conditions. Management: use certified disease-free seed, rotate away "
            "from beans for at least two seasons, avoid working in the field when "
            "foliage is wet, and remove crop debris. Resistant varieties and timely "
            "fungicide sprays reduce losses in high-pressure seasons."
        ),
    },
    # ---- Harvesting timing -----------------------------------------------
    {
        "title": "Maize and bean harvesting timing",
        "source": "rab_harvest_maize_bean",
        "content": (
            "Harvest maize when the grain is physiologically mature: husks have "
            "dried, kernels are hard and a black layer forms at the kernel base, "
            "usually at 18-20% grain moisture. Dry cobs further to about 13% before "
            "shelling and storage to prevent aflatoxin and weevils. Harvest beans "
            "when most pods have turned yellow-brown and dry and the leaves have "
            "fallen; pull or cut plants in the morning to limit shattering, then dry "
            "before threshing. Store dry grain in clean, airtight containers, ideally "
            "with hermetic bags."
        ),
    },
    {
        "title": "Potato and cassava harvesting timing",
        "source": "rab_harvest_potato_cassava",
        "content": (
            "Irish potato is ready when the haulms (tops) yellow and die back, "
            "usually 90-120 days after planting depending on variety; the skins "
            "should be set (not rubbing off) for storage. Harvest in dry weather and "
            "cure tubers in a cool, dark, ventilated place. Cassava can be harvested "
            "from about 9-12 months, and many varieties can be left in the ground and "
            "lifted as needed, which is valuable for food security during dry "
            "seasons. Process roots quickly after lifting because they spoil within "
            "a few days."
        ),
    },
    # ---- Drought coping / climate resilience -----------------------------
    {
        "title": "Drought coping strategies for Bugesera",
        "source": "rab_drought_coping",
        "content": (
            "Bugesera is a semi-arid district prone to recurrent drought and erratic "
            "rainfall. To cope, farmers should: grow drought-tolerant crops and "
            "early-maturing varieties (cassava, sorghum, cowpea, improved beans and "
            "maize); harvest and store rainwater in ponds, tanks and tied ridges; "
            "mulch heavily to cut evaporation; apply water efficiently with drip or "
            "small-scale irrigation during critical growth stages; and add organic "
            "matter to improve soil water-holding capacity. Diversifying crops and "
            "staggering planting dates spreads risk across the season."
        ),
    },
    {
        "title": "Water harvesting and conservation agriculture",
        "source": "rab_water_harvesting",
        "content": (
            "Conservation agriculture builds resilience on Bugesera's fragile soils "
            "through minimum tillage, permanent soil cover (mulch or cover crops) "
            "and crop rotation. These practices increase infiltration, reduce runoff "
            "and evaporation, and raise soil organic matter over time. Combine them "
            "with in-field water harvesting such as tied ridges, contour bunds, "
            "planting basins (zai pits) and small retention ponds so that scarce "
            "rainfall is captured where crops can use it. Prioritise stored water for "
            "the crop's most sensitive stages, especially flowering."
        ),
    },
]


class Command(BaseCommand):
    help = "Ingest knowledge documents into the RAG store (chunk + embed)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            default=None,
            help="Directory of .txt/.md documents to ingest.",
        )

    def handle(self, *args, **options):
        service = KnowledgeService()
        docs = []
        directory = options.get("dir")
        if directory:
            base = Path(directory)
            for path in sorted(base.glob("**/*")):
                if path.suffix.lower() in (".txt", ".md"):
                    docs.append(
                        {
                            "title": path.stem.replace("_", " ").title(),
                            "source": path.stem,
                            "content": path.read_text(encoding="utf-8"),
                        }
                    )
        if not docs:
            docs = BUILTIN_DOCS
            self.stdout.write("No --dir given; using built-in sample corpus.")

        total_chunks = 0
        for doc in docs:
            n = service.ingest_document(
                title=doc["title"], source=doc["source"], content=doc["content"]
            )
            total_chunks += n
            self.stdout.write(
                self.style.SUCCESS(f"  {doc['source']}: {n} chunks")
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(docs)} documents ({total_chunks} chunks)."
            )
        )

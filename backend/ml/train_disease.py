"""Train a crop-disease classifier via MobileNetV2 transfer learning (Keras).

This is a genuine transfer-learning script: a MobileNetV2 base pre-trained on
ImageNet (frozen) -> GlobalAveragePooling -> Dropout -> softmax over the crop
disease classes. It reads an ImageFolder-style dataset and saves
``disease_mobilenetv2.keras`` + ``labels.json`` into ``ml/artifacts/``.

TensorFlow is an OPTIONAL, heavy dependency and is intentionally NOT imported at
module load time, so importing this module never breaks the app. It is imported
lazily inside ``main()``; the runtime inference path (ml/disease.py) likewise
imports TF lazily and falls back to a deterministic stub when TF/artifact are
absent.

ENABLING DISEASE CNN TRAINING
-----------------------------
1. In requirements.txt, uncomment:  tensorflow-cpu==2.16.1  (then reinstall).
2. Prepare a dataset directory in ImageFolder layout, one sub-folder per class::

       data/diseases/
         healthy/            *.jpg
         maize_leaf_blight/  *.jpg
         bean_rust/          *.jpg
         cassava_mosaic/     *.jpg
         potato_late_blight/ *.jpg

   Class (folder) names should match the keys in ml/disease.py CLASS_GUIDE so
   treatment guidance resolves correctly.
3. Run (inside the backend container)::

       docker exec sm_backend python ml/train_disease.py --data-dir data/diseases --epochs 8

The produced ``disease_mobilenetv2.keras`` is then auto-loaded by
DiseaseClassifier on the next request.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
IMG_SIZE = (224, 224)

# Default class set (must match sub-folder names in the dataset).
DEFAULT_CLASSES = [
    "healthy",
    "maize_leaf_blight",
    "bean_rust",
    "cassava_mosaic",
    "potato_late_blight",
]


def build_model(num_classes: int, dropout: float = 0.2):
    """Frozen ImageNet MobileNetV2 base -> GAP -> Dropout -> softmax head."""
    import tensorflow as tf
    from tensorflow.keras import layers, models
    from tensorflow.keras.applications import MobileNetV2

    base = MobileNetV2(
        input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet"
    )
    base.trainable = False  # transfer learning: freeze the backbone

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    # MobileNetV2 expects inputs scaled to [-1, 1]; preprocess inside the graph.
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir", required=True,
        help="ImageFolder-style dataset root (one sub-folder per class).",
    )
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--val-split", type=float, default=0.2)
    args = parser.parse_args()

    import tensorflow as tf

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise SystemExit(f"Dataset directory not found: {data_dir}")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=args.val_split,
        subset="training",
        seed=42,
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="int",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=args.val_split,
        subset="validation",
        seed=42,
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="int",
    )
    class_names = list(train_ds.class_names)
    print("Classes:", class_names)

    # Light augmentation to combat overfitting on small field datasets.
    augment = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.1),
        tf.keras.layers.RandomZoom(0.1),
    ])
    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.map(lambda x, y: (augment(x), y)).prefetch(autotune)
    val_ds = val_ds.prefetch(autotune)

    model = build_model(num_classes=len(class_names))
    model.summary()
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs)

    model_path = ARTIFACTS_DIR / "disease_mobilenetv2.keras"
    labels_path = ARTIFACTS_DIR / "labels.json"
    model.save(model_path)
    with open(labels_path, "w", encoding="utf-8") as fh:
        json.dump({str(i): name for i, name in enumerate(class_names)}, fh, indent=2)

    print(f"Saved model -> {model_path}")
    print(f"Saved labels -> {labels_path}")


if __name__ == "__main__":
    main()

import json
import os
import signal
import sys
from confluent_kafka import Consumer, Producer


BOOTSTRAP_SERVERS = os.getenv("BROKER_BOOTSTRAP_SERVERS", "")
RAW_TOPIC = os.getenv("RAW_TOPIC", "raw_topic")
CLEANSED_TOPIC = os.getenv("CLEANSED_TOPIC", "cleansed_topic")
GROUP_ID = os.getenv("CONSUMER_GROUP_ID", "azure-cleansing-group")

running = True


def stop_handler(_signum, _frame):
    global running
    running = False


def cleanse_payload(payload):
    cleansed = dict(payload)

    # TODO: Replace this simple masking with the final cleansing rule.
    if "driver_code" in cleansed:
        cleansed["driver_code"] = "masked"

    cleansed["pipeline_stage"] = "cleansed"
    return cleansed


def main():
    if not BOOTSTRAP_SERVERS:
        raise RuntimeError("BROKER_BOOTSTRAP_SERVERS is required")

    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    consumer = Consumer(
        {
            "bootstrap.servers": BOOTSTRAP_SERVERS,
            "group.id": GROUP_ID,
            "auto.offset.reset": "earliest",
        }
    )
    producer = Producer({"bootstrap.servers": BOOTSTRAP_SERVERS})

    consumer.subscribe([RAW_TOPIC])

    try:
        while running:
            message = consumer.poll(1.0)
            if message is None:
                continue
            if message.error():
                print(f"Consumer error: {message.error()}", file=sys.stderr)
                continue

            payload = json.loads(message.value().decode("utf-8"))
            cleansed = cleanse_payload(payload)

            producer.produce(CLEANSED_TOPIC, json.dumps(cleansed).encode("utf-8"))
            producer.flush()
            print(f"Forwarded message from {RAW_TOPIC} to {CLEANSED_TOPIC}")
    finally:
        consumer.close()


if __name__ == "__main__":
    main()

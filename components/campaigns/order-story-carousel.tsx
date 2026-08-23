import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MoveHorizontal } from "lucide-react";
import styles from "./order-story-carousel.module.css";

const campaignPath =
  "/campaigns/social/2026-08-21-ordering-how-it-works-carousel-v1";

export const orderStoryFrames = [
  {
    src: `${campaignPath}/01-exact-product-story.jpg`,
    label: "Find the exact product",
    alt: "JeloCare order step one: open the exact product page.",
  },
  {
    src: `${campaignPath}/02-start-shopping-story.jpg`,
    label: "Start shopping there",
    alt: "JeloCare order step two: add the product and start a basket with one retailer.",
  },
  {
    src: `${campaignPath}/03-keep-shopping-story.jpg`,
    label: "Keep shopping",
    alt: "JeloCare order step three: add exact products from the same retailer.",
  },
  {
    src: `${campaignPath}/04-review-basket-story.jpg`,
    label: "Review the basket",
    alt: "JeloCare order step four: review the basket and its retailer selection.",
  },
  {
    src: `${campaignPath}/05-contact-story.jpg`,
    label: "Add contact details",
    alt: "JeloCare order step five: enter contact details without creating an account.",
  },
  {
    src: `${campaignPath}/06-delivery-story.jpg`,
    label: "Add delivery details",
    alt: "JeloCare order step six: add the delivery location for the guest order.",
  },
  {
    src: `${campaignPath}/07-review-request-story.jpg`,
    label: "Review the request",
    alt: "JeloCare order step seven: review the basket, delivery details and order terms.",
  },
  {
    src: `${campaignPath}/08-request-received-story.jpg`,
    label: "Request received",
    alt: "JeloCare order step eight: follow the request while JeloCare prepares the complete quote.",
  },
] as const;

export function OrderStoryCarousel() {
  return (
    <section className={styles.story} aria-labelledby="order-story-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>How to order</p>
          <h2 className={styles.heading} id="order-story-title">
            Order in eight swipes.
          </h2>
        </div>
        <div className={styles.intro}>
          <p>One store. One basket. One complete quote before payment.</p>
          <Link className={styles.cta} href="/products">
            Browse products <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <ol
        className={styles.rail}
        aria-label="How to order from JeloCare in eight steps"
        aria-describedby="order-story-scroll-hint"
        tabIndex={0}
      >
        {orderStoryFrames.map((frame, index) => (
          <li className={styles.card} key={frame.src}>
            <figure>
              <Image
                className={styles.art}
                src={frame.src}
                alt={frame.alt}
                width={1080}
                height={1920}
                sizes="(max-width: 720px) 82vw, (max-width: 1200px) 38vw, 22rem"
              />
              <figcaption>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{frame.label}</strong>
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>

      <p className={styles.hint} id="order-story-scroll-hint">
        <MoveHorizontal size={17} aria-hidden="true" />
        Swipe or scroll through the steps
      </p>
    </section>
  );
}

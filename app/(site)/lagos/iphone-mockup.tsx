import type { CSSProperties, ReactNode } from "react";
import styles from "./iphone-mockup.module.css";

/**
 * 3D iPhone 17 mockup with a stylised JeloCare screen inside.
 * Uses CSS perspective transforms for a premium 3D look.
 */
function PhoneFrame({
  screen,
  rotate,
  translateY,
  zIndex,
}: {
  screen: ReactNode;
  rotate: number;
  translateY: number;
  zIndex: number;
}) {
  return (
    <div
      className={styles.phone}
      style={
        {
          transform: `translateY(${translateY}px) rotateY(${rotate}deg)`,
          zIndex,
        } as CSSProperties
      }
    >
      <div className={styles.titanium}>
        <div className={styles.screen}>{screen}</div>
        <div className={styles.island} />
      </div>
      <div className={`${styles.btn} ${styles.btnLeft}`} />
      <div className={`${styles.btn} ${styles.btnRightTop}`} />
      <div className={`${styles.btn} ${styles.btnRightBottom}`} />
    </div>
  );
}

function ScreenHeader() {
  return (
    <div className={styles.header}>
      <span>9:41</span>
      <span className={styles.headerBrand}>JeloCare</span>
      <span className={styles.headerSignal}>5G</span>
    </div>
  );
}

function ProductCard({
  brand,
  name,
  price,
  dark,
}: {
  brand: string;
  name: string;
  price: string;
  dark?: boolean;
}) {
  return (
    <div className={`${styles.card} ${dark ? styles.cardDark : ""}`}>
      <div className={styles.cardImage} />
      <div className={styles.cardText}>
        <span className={styles.cardBrand}>{brand}</span>
        <span className={styles.cardName}>{name}</span>
        <span className={styles.cardPrice}>{price}</span>
      </div>
    </div>
  );
}

/* ── Order flow screens ── */

function OrderScreen1() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.title}>Products</div>
        <div className={styles.search} />
        <div className={styles.grid}>
          <ProductCard brand="COSRX" name="Cleanser" price="₦12,500" />
          <ProductCard brand="Anua" name="Niacinamide" price="₦18,900" dark />
          <ProductCard brand="PanOxyl" name="Benzoyl Wash" price="₦15,300" />
          <ProductCard brand="Dove" name="Argan Bar" price="₦4,500" dark />
        </div>
      </div>
      <div className={styles.tabbar}>
        <span className={`${styles.tab} ${styles.tabActive}`}>Products</span>
        <span className={styles.tab}>Guides</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function OrderScreen2() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.productHero} />
        <div className={styles.productInfo}>
          <span className={styles.productBrand}>COSRX</span>
          <span className={styles.productName}>
            Salicylic Acid Daily Gentle Cleanser
          </span>
          <span className={styles.productSize}>150 ml</span>
          <div className={styles.priceRow}>
            <span className={styles.price}>₦12,500</span>
            <span className={styles.priceStrike}>₦15,000</span>
          </div>
          <div className={styles.stores}>
            <span className={styles.storeDot} />
            <span className={styles.storeText}>3 Nigerian stores</span>
          </div>
          <div className={styles.addButton}>Add to basket</div>
        </div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={styles.tab}>Guides</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function OrderScreen3() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.title}>Your basket</div>
        <div className={styles.basketItem}>
          <div className={styles.basketImage} />
          <div className={styles.basketText}>
            <span className={styles.basketBrand}>COSRX</span>
            <span className={styles.basketName}>Salicylic Acid Cleanser</span>
            <span className={styles.basketPrice}>₦12,500</span>
          </div>
        </div>
        <div className={styles.divider} />
        <div className={styles.total}>
          <span>Total</span>
          <span className={styles.totalPrice}>₦12,500</span>
        </div>
        <div className={styles.addButton}>Request quote</div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Basket</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function OrderScreen4() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={`${styles.body} ${styles.bodyCenter}`}>
        <div className={styles.checkIcon} />
        <div className={styles.confirmTitle}>Order confirmed</div>
        <div className={styles.confirmText}>
          We&apos;re procuring your product from the retailer.
        </div>
        <div className={styles.confirmSteps}>
          <div className={`${styles.confirmStep} ${styles.confirmStepDone}`}>
            <span className={styles.confirmStepDot} /> Paid
          </div>
          <div className={`${styles.confirmStep} ${styles.confirmStepDone}`}>
            <span className={styles.confirmStepDot} /> Procuring
          </div>
          <div className={styles.confirmStep}>
            <span className={styles.confirmStepDot} /> Delivering
          </div>
        </div>
        <div className={styles.addButton}>Track order</div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={styles.tab}>Guides</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Me</span>
      </div>
    </div>
  );
}

/* ── Bundle flow screens ── */

function BundleScreen1() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.title}>Build a bundle</div>
        <div className={styles.subtitle}>Pick products from any store</div>
        <div className={styles.grid}>
          <ProductCard brand="COSRX" name="Cleanser" price="₦12,500" dark />
          <ProductCard brand="Anua" name="Niacinamide" price="₦18,900" />
          <ProductCard brand="B.LAB" name="Sunscreen" price="₦9,800" dark />
          <ProductCard brand="Dove" name="Body Bar" price="₦4,500" />
        </div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Bundle</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function BundleScreen2() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.title}>Your routine</div>
        <div className={styles.routineStep}>
          <span className={styles.routineNum}>1</span>
          <span className={styles.routineLabel}>Cleanse</span>
          <span className={styles.routineBrand}>COSRX</span>
        </div>
        <div className={styles.routineStep}>
          <span className={styles.routineNum}>2</span>
          <span className={styles.routineLabel}>Treat</span>
          <span className={styles.routineBrand}>Anua</span>
        </div>
        <div className={styles.routineStep}>
          <span className={styles.routineNum}>3</span>
          <span className={styles.routineLabel}>Protect</span>
          <span className={styles.routineBrand}>B.LAB</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.total}>
          <span>3 products</span>
          <span className={styles.totalPrice}>₦41,200</span>
        </div>
        <div className={styles.addButton}>Get single quote</div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Bundle</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function BundleScreen3() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={styles.body}>
        <div className={styles.title}>Bundle quote</div>
        <div className={styles.quoteItem}>
          <span>COSRX Cleanser</span>
          <span>₦12,500</span>
        </div>
        <div className={styles.quoteItem}>
          <span>Anua Niacinamide</span>
          <span>₦18,900</span>
        </div>
        <div className={styles.quoteItem}>
          <span>B.LAB Sunscreen</span>
          <span>₦9,800</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.total}>
          <span>Total</span>
          <span className={styles.totalPrice}>₦41,200</span>
        </div>
        <div className={styles.storeText}>One delivery · One return window</div>
        <div className={styles.addButton}>Order bundle</div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Bundle</span>
        <span className={styles.tab}>Me</span>
      </div>
    </div>
  );
}

function BundleScreen4() {
  return (
    <div className={styles.content}>
      <ScreenHeader />
      <div className={`${styles.body} ${styles.bodyCenter}`}>
        <div className={styles.checkIcon} />
        <div className={styles.confirmTitle}>Bundle ordered</div>
        <div className={styles.confirmText}>
          3 products procured from 2 stores. One delivery.
        </div>
        <div className={styles.confirmSteps}>
          <div className={`${styles.confirmStep} ${styles.confirmStepDone}`}>
            <span className={styles.confirmStepDot} /> Paid
          </div>
          <div className={`${styles.confirmStep} ${styles.confirmStepDone}`}>
            <span className={styles.confirmStepDot} /> Procuring
          </div>
          <div className={styles.confirmStep}>
            <span className={styles.confirmStepDot} /> Delivering
          </div>
        </div>
        <div className={styles.addButton}>Track bundle</div>
      </div>
      <div className={styles.tabbar}>
        <span className={styles.tab}>Products</span>
        <span className={styles.tab}>Guides</span>
        <span className={`${styles.tab} ${styles.tabActive}`}>Me</span>
      </div>
    </div>
  );
}

/* ── Public components ── */

export function OrderPhoneMockup() {
  const screens = [
    <OrderScreen1 key="1" />,
    <OrderScreen2 key="2" />,
    <OrderScreen3 key="3" />,
    <OrderScreen4 key="4" />,
  ];
  const rotations = [-12, 8, -8, 12];
  const offsets = [0, 40, 20, 60];

  return (
    <div className={styles.zigzag}>
      {screens.map((screen, i) => (
        <PhoneFrame
          key={i}
          screen={screen}
          rotate={rotations[i]!}
          translateY={offsets[i]!}
          zIndex={10 - i}
        />
      ))}
    </div>
  );
}

export function BundlePhoneMockup() {
  const screens = [
    <BundleScreen1 key="1" />,
    <BundleScreen2 key="2" />,
    <BundleScreen3 key="3" />,
    <BundleScreen4 key="4" />,
  ];
  const rotations = [12, -8, 8, -12];
  const offsets = [60, 20, 40, 0];

  return (
    <div className={styles.zigzag}>
      {screens.map((screen, i) => (
        <PhoneFrame
          key={i}
          screen={screen}
          rotate={rotations[i]!}
          translateY={offsets[i]!}
          zIndex={10 - i}
        />
      ))}
    </div>
  );
}

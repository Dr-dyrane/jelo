import Link from "next/link";
import {
  ArrowDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  History,
  MapPinned,
  PackageSearch,
  RefreshCw,
  ScanSearch,
  Share2,
  Store,
  type LucideIcon,
} from "lucide-react";
import { RelativeTime } from "@/components/ops/chips/RelativeTime";
import type {
  MarketTruthLayer,
  MarketTruthLayerId,
  MarketTruthLayerState,
  MarketTruthReadModel,
} from "@/lib/market-truth/types";
import styles from "./market-health.module.css";

const number = new Intl.NumberFormat("en-NG");

const layerIcons: Record<MarketTruthLayerId, LucideIcon> = {
  inventory: RefreshCw,
  offers: PackageSearch,
  retailers: Store,
  discovery: ScanSearch,
  "physical-markets": MapPinned,
  "daily-desk": ClipboardList,
  "public-projections": Share2,
};

const stateLabels: Record<MarketTruthLayerState, string> = {
  current: "Current",
  review: "Review",
  attention: "Attention",
  unknown: "Unknown",
};

const stateIcons: Record<MarketTruthLayerState, LucideIcon> = {
  current: CircleCheck,
  review: History,
  attention: CircleAlert,
  unknown: CircleHelp,
};

function metricValue(value: number | string) {
  return typeof value === "number" ? number.format(value) : value;
}

function readableCountLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function LayerRow({ layer, last }: { layer: MarketTruthLayer; last: boolean }) {
  const LayerIcon = layerIcons[layer.id];
  const StateIcon = stateIcons[layer.state];
  return (
    <li id={layer.id} className={styles.layer} data-state={layer.state}>
      <span className={styles.layerTrack} aria-hidden="true">
        <span className={styles.layerIcon}>
          <LayerIcon size={19} strokeWidth={1.7} />
        </span>
        {!last ? <ArrowDown size={15} strokeWidth={1.5} /> : null}
      </span>
      <div className={styles.layerBody}>
        <header className={styles.layerHeading}>
          <h3>{layer.label}</h3>
          <span className={styles.state} data-state={layer.state}>
            <StateIcon size={15} strokeWidth={1.8} aria-hidden="true" />
            {stateLabels[layer.state]}
          </span>
        </header>
        <p>{layer.summary}</p>
        {layer.metrics.length > 0 ? (
          <dl className={styles.metrics}>
            {layer.metrics.map((metric) => (
              <div key={metric.label} data-state={metric.state ?? "current"}>
                <dt>{metric.label}</dt>
                <dd>{metricValue(metric.value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {layer.observedAt ? (
          <span className={styles.observed}>
            Checked <RelativeTime iso={layer.observedAt} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function MarketHealthMonitor({
  model,
}: {
  model: MarketTruthReadModel;
}) {
  const criticalCount = model.exceptions.filter(
    (item) => item.severity === "critical",
  ).length;
  const warningCount = model.exceptions.length - criticalCount;

  return (
    <div className={styles.surface}>
      <section className={styles.chainSection} aria-labelledby="truth-chain">
        <header className={styles.sectionHeading}>
          <div>
            <h2 id="truth-chain">Linked truth</h2>
            <p>
              {model.exceptions.length > 0
                ? `${number.format(criticalCount)} critical · ${number.format(warningCount)} warning`
                : model.state === "review"
                  ? "Review work is open"
                  : "Every measured link is current"}
            </p>
          </div>
          <span>
            Checked <RelativeTime iso={model.generatedAt} />
          </span>
        </header>

        <ol className={styles.chain}>
          {model.layers.map((layer, index) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              last={index === model.layers.length - 1}
            />
          ))}
        </ol>
      </section>

      {model.exceptions.length > 0 ? (
        <section
          className={styles.exceptionSection}
          aria-labelledby="market-exceptions"
        >
          <header className={styles.sectionHeading}>
            <div>
              <h2 id="market-exceptions">Exceptions</h2>
              <p>{number.format(model.exceptions.length)} need a named owner</p>
            </div>
          </header>
          <ol className={styles.exceptionList}>
            {model.exceptions.map((item) => (
              <li key={item.id} data-severity={item.severity}>
                <span className={styles.exceptionMark} aria-hidden="true">
                  <CircleAlert size={18} strokeWidth={1.8} />
                </span>
                <div className={styles.exceptionBody}>
                  <div className={styles.exceptionHeading}>
                    <h3>{item.title}</h3>
                    <span>{item.severity}</span>
                  </div>
                  <p>{item.summary}</p>
                  <span className={styles.observed}>
                    Observed <RelativeTime iso={item.observedAt} />
                  </span>
                  <details className={styles.disclosure}>
                    <summary>Response</summary>
                    <dl>
                      <div>
                        <dt>Threshold</dt>
                        <dd>{item.threshold}</dd>
                      </div>
                      <div>
                        <dt>Owner</dt>
                        <dd>{item.owner}</dd>
                      </div>
                      <div>
                        <dt>Runbook</dt>
                        <dd>{item.runbook}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
                <Link href={item.actionHref} className={styles.actionLink}>
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section
        className={styles.ownerSection}
        aria-labelledby="scheduled-owners"
      >
        <header className={styles.sectionHeading}>
          <div>
            <h2 id="scheduled-owners">Scheduled owners</h2>
            <p>Hourly receipts only</p>
          </div>
        </header>
        <ol className={styles.ownerList}>
          {model.scheduledOwners.map((owner) => {
            const receipt = owner.receipt;
            const outcomeAt =
              receipt?.completedAt ?? receipt?.failedAt ?? receipt?.startedAt;
            return (
              <li
                id={`owner-${owner.id}`}
                key={owner.id}
                data-state={owner.state}
              >
                <div className={styles.ownerHeading}>
                  <div>
                    <h3>{owner.label}</h3>
                    <p>{owner.summary}</p>
                  </div>
                  {outcomeAt ? (
                    <RelativeTime iso={outcomeAt} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <details className={styles.disclosure}>
                  <summary>Receipt</summary>
                  {receipt ? (
                    <dl>
                      <div>
                        <dt>Started</dt>
                        <dd>
                          <time dateTime={receipt.startedAt}>
                            {receipt.startedAt}
                          </time>
                        </dd>
                      </div>
                      {receipt.completedAt ? (
                        <div>
                          <dt>Completed</dt>
                          <dd>
                            <time dateTime={receipt.completedAt}>
                              {receipt.completedAt}
                            </time>
                          </dd>
                        </div>
                      ) : null}
                      {receipt.failedAt ? (
                        <div>
                          <dt>Failed</dt>
                          <dd>
                            <time dateTime={receipt.failedAt}>
                              {receipt.failedAt}
                            </time>
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Outcome</dt>
                        <dd>{readableCountLabel(receipt.outcomeCode)}</dd>
                      </div>
                      <div>
                        <dt>Revision</dt>
                        <dd className={styles.revision}>{receipt.revision}</dd>
                      </div>
                      {Object.entries(receipt.counts).map(([label, value]) => (
                        <div key={label}>
                          <dt>{readableCountLabel(label)}</dt>
                          <dd>{number.format(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>No valid receipt is available.</p>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

import { useAnimatedNumber } from '../animations/price';
import { usePrice } from '../store/configurator';

interface Props {
  onReview: () => void;
}

export function PriceBar({ onReview }: Props) {
  const { total } = usePrice();
  const displayRef = useAnimatedNumber(total, '$');

  return (
    <div className="price-bar">
      <div className="container price-bar-inner">
        <p className="price-total" aria-hidden="true">
          <span className="price-total-label">Total</span>
          {/* Deliberately childless: GSAP owns this text node. */}
          <span className="price-total-value" ref={displayRef} />
        </p>
        {/* The visible number ticks once per animation frame, which a live
            region would announce ~30 times per change. Announce the settled
            total instead. */}
        <p className="sr-only" aria-live="polite">Total ${total}</p>
        <button type="button" className="btn" onClick={onReview}>
          Review build
        </button>
      </div>
    </div>
  );
}

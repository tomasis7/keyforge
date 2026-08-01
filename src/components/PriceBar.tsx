import { useAnimatedNumber } from '../animations/price';
import { usePrice } from '../store/configurator';

interface Props {
  onReview: () => void;
}

export function PriceBar({ onReview }: Props) {
  const { total } = usePrice();
  const display = useAnimatedNumber(total);

  return (
    <div className="price-bar">
      <div className="container price-bar-inner">
        <p className="price-total" aria-live="polite">
          <span className="price-total-label">Total</span>
          <span className="price-total-value">${display}</span>
        </p>
        <button type="button" className="btn" onClick={onReview}>
          Review build
        </button>
      </div>
    </div>
  );
}

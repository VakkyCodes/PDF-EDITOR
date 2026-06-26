import { render, screen } from '@testing-library/react';
import App from './App';

test('renders PDF editor title', () => {
  render(<App />);
  const headingElement = screen.getByText(/pdf editor/i);
  expect(headingElement).toBeInTheDocument();
});

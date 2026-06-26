import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AstraPDF title', () => {
  render(<App />);
  const headingElement = screen.getByText(/astrapdf/i);
  expect(headingElement).toBeInTheDocument();
});

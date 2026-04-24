// @vitest-environment jsdom
/**
 * Tests for ModelPricingCard.
 *
 * The SWR hook is mocked at the module level so the test never touches fetch
 * or the network. Each case drives a different hook return to verify that the
 * component renders the correct state: loading skeleton, error banner (generic
 * and 404), data display, and null-id no-render.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Hook mock — state lives in module-scoped var that tests mutate per-case
// ---------------------------------------------------------------------------

import type { UseOpenRouterModelResult } from '../use-openrouter-model';

const hookState: UseOpenRouterModelResult = {
  model: null,
  isLoading: false,
  error: null,
};

vi.mock('../use-openrouter-model', () => ({
  useOpenRouterModel: (_id: string | null) => hookState,
}));

// ---------------------------------------------------------------------------
// Subject under test (imported after mock is registered)
// ---------------------------------------------------------------------------

import { ModelPricingCard } from '../model-pricing-card';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  hookState.model = null;
  hookState.isLoading = false;
  hookState.error = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelPricingCard', () => {
  it('renders nothing when modelId is empty string', () => {
    const { container } = render(<ModelPricingCard modelId="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a loading skeleton while the hook is fetching', () => {
    hookState.isLoading = true;
    render(<ModelPricingCard modelId="moonshotai/kimi-k2-thinking" />);
    // The animate-pulse div is the loading indicator.
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows a destructive error for NOT_FOUND (404)', () => {
    hookState.error = new Error('NOT_FOUND');
    render(<ModelPricingCard modelId="fake/nonexistent" />);
    expect(screen.getByText(/Model not found on OpenRouter/i)).toBeInTheDocument();
    // The card should have a destructive border class.
    const card = document.querySelector('[data-slot="card"]');
    expect(card).toHaveClass('border-destructive');
  });

  it('shows a generic error message for non-404 failures', () => {
    hookState.error = new Error('upstream 502');
    render(<ModelPricingCard modelId="some/model" />);
    expect(screen.getByText(/Failed to load model info: upstream 502/i)).toBeInTheDocument();
  });

  it('renders model name, id, context length, and both prices when data is available', () => {
    hookState.model = {
      id: 'moonshotai/kimi-k2-thinking',
      name: 'Kimi K2 Thinking',
      contextLength: 200000,
      inputPricePer1M: 0.6,
      outputPricePer1M: 2.5,
      description: null,
    };
    render(<ModelPricingCard modelId="moonshotai/kimi-k2-thinking" />);

    expect(screen.getByText('Kimi K2 Thinking')).toBeInTheDocument();
    expect(screen.getByText('moonshotai/kimi-k2-thinking')).toBeInTheDocument();
    // Context length rendered with locale formatting
    expect(screen.getByText(/200,000/)).toBeInTheDocument();
    // Input price
    expect(screen.getByText(/\$0\.60\/1M in/)).toBeInTheDocument();
    // Output price
    expect(screen.getByText(/\$2\.50\/1M out/)).toBeInTheDocument();
  });
});

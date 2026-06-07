/**
 * Phase 12 Plan 12-09 Task 2 — SaveSearchBar contract (NCEN-06 / NSUB-01/03 /
 * CTX D-08/D-09, RESEARCH Pitfall 4 + Pitfall 5).
 *
 * Load-bearing contracts locked here:
 *   Pitfall 4/5 — the CTA tap maps RU-label activeFilters ('Цена','Год') to the
 *                 CANONICAL criteria object (priceMin/priceMax/yearMin/yearMax +
 *                 makeId/modelId as ObjectId strings + bodyType) and POSTs it at
 *                 INSTANT cadence.
 *   D-09 Undo   — the success-toast Undo deletes the just-created subscription
 *                 by its returned id.
 *   D-08        — the bar does not render when no filters are active.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { SaveSearchBar } from '../SaveSearchBar';
import { NotificationService } from '../../../services/notifications/NotificationService';

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      saveSearchCta: 'Notify me about new matches',
      saveSearchToast: "We'll alert you about new matches",
      saveSearchUndo: 'Undo',
    },
  }),
}));

jest.mock('../../../services/notifications/NotificationService', () => ({
  NotificationService: {
    createSubscription: jest.fn().mockResolvedValue({ _id: 'saved_1' }),
    deleteSubscription: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

const createMock = NotificationService.createSubscription as jest.Mock;
const deleteMock = NotificationService.deleteSubscription as jest.Mock;

const mounted: TestRenderer.ReactTestRenderer[] = [];

function render(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(node);
  });
  mounted.push(tree);
  return tree;
}

async function pressById(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findByProps({ testID });
  await act(async () => {
    node.props.onPress();
  });
}

const SEEDED_FILTERS = {
  Цена: { min: '5000', max: '20000' },
  Год: { min: '2015', max: '2022' },
};
const SELECTED_MAKE = { id: '64a1b2c3d4e5f60011223344', name: 'Toyota' };
const SELECTED_MODEL = { id: '64a1b2c3d4e5f60055667788', name: 'Camry' };

beforeEach(() => {
  jest.useFakeTimers();
  createMock.mockClear();
  deleteMock.mockClear();
  createMock.mockResolvedValue({ _id: 'saved_1' });
  deleteMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  // Unmount (clears the toast cleanup effect) then flush any pending timer
  // before teardown so no setTimeout fires after the Jest env is gone.
  act(() => {
    mounted.forEach((tree) => tree.unmount());
    jest.runOnlyPendingTimers();
  });
  mounted.length = 0;
  jest.useRealTimers();
});

describe('SaveSearchBar — Pitfall 4/5 criteria mapping (RU labels → canonical ObjectId criteria)', () => {
  it('CTA tap creates a saved_search at instant cadence with the canonical criteria object', async () => {
    const tree = render(
      <SaveSearchBar
        activeFilters={SEEDED_FILTERS}
        selectedMake={SELECTED_MAKE}
        selectedModel={SELECTED_MODEL}
        bodyType="Седан"
      />,
    );
    await pressById(tree, 'save-search-cta');

    expect(createMock).toHaveBeenCalledTimes(1);
    const body = createMock.mock.calls[0][0];
    expect(body.kind).toBe('saved_search');
    expect(body.cadence).toBe('instant');
    // RU labels mapped to canonical English fields; makeId/modelId are the
    // ObjectId strings (NOT the make/model names) — Pitfall 4 + Pitfall 5.
    expect(body.criteria).toEqual({
      makeId: '64a1b2c3d4e5f60011223344',
      modelId: '64a1b2c3d4e5f60055667788',
      priceMin: 5000,
      priceMax: 20000,
      yearMin: 2015,
      yearMax: 2022,
      bodyType: 'Седан',
    });
    // Defensive: the name strings must NOT leak into criteria.
    expect(JSON.stringify(body.criteria)).not.toContain('Toyota');
    expect(JSON.stringify(body.criteria)).not.toContain('Camry');
  });
});

describe('SaveSearchBar — D-09 toast-with-Undo', () => {
  it('tapping Undo deletes the just-created subscription by its returned id', async () => {
    const tree = render(
      <SaveSearchBar
        activeFilters={SEEDED_FILTERS}
        selectedMake={SELECTED_MAKE}
        selectedModel={SELECTED_MODEL}
        bodyType={null}
      />,
    );
    await pressById(tree, 'save-search-cta');
    // The toast (with Undo) is now visible.
    expect(tree.root.findByProps({ testID: 'save-search-toast' })).toBeTruthy();

    await pressById(tree, 'save-search-undo');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('saved_1');
  });
});

describe('SaveSearchBar — D-08 visibility', () => {
  it('renders nothing when no filters are active', () => {
    const tree = render(
      <SaveSearchBar
        activeFilters={{}}
        selectedMake={null}
        selectedModel={null}
        bodyType={null}
      />,
    );
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing when only sort keys are present (not real filters)', () => {
    const tree = render(
      <SaveSearchBar
        activeFilters={{ sortPrice: 'asc' }}
        selectedMake={null}
        selectedModel={null}
        bodyType={null}
      />,
    );
    expect(tree.toJSON()).toBeNull();
  });
});

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { GreetingBlock } from '../GreetingBlock';

describe('GreetingBlock', () => {
  test('renders time-of-day, subject, headline, and count chip', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <GreetingBlock
            timeOfDay="Доброе утро"
            subject="Becky · Москва"
            headline="Найдём ваше идеальное авто."
            listingsCount={42}
            listingsNoun="объявлений"
          />
        </UIVersionProvider>
      );
    });
    const texts = tree!.root.findAllByType(Text).map((n) => n.props.children);
    const joined = JSON.stringify(texts);
    expect(joined).toContain('Доброе утро');
    expect(joined).toContain('Becky · Москва');
    expect(joined).toContain('Найдём ваше идеальное авто.');
    expect(joined).toContain('42');
    expect(joined).toContain('объявлений');
  });

  test('omits the divider when subject is absent', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <GreetingBlock
            timeOfDay="Доброе утро"
            headline="Найдём ваше идеальное авто."
            listingsCount={0}
            listingsNoun="объявлений"
          />
        </UIVersionProvider>
      );
    });
    const texts = tree!.root.findAllByType(Text).map((n) => n.props.children);
    const joined = JSON.stringify(texts);
    expect(joined).toContain('Доброе утро');
    expect(joined).not.toContain(' · ');
  });
});

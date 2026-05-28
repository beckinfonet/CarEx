import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { UIVersionProvider } from '../../../../context/UIVersionContext';
import { GreetingBlock } from '../GreetingBlock';

describe('GreetingBlock', () => {
  test('renders time-of-day, city, headline, and count chip', async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        <UIVersionProvider>
          <GreetingBlock
            timeOfDay="Доброе утро"
            city="Москва"
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
    expect(joined).toContain('Москва');
    expect(joined).toContain('Найдём ваше идеальное авто.');
    expect(joined).toContain('42');
    expect(joined).toContain('объявлений');
  });
});

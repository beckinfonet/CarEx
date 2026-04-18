import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Search } from 'lucide-react-native';
import { EmptyState } from '../EmptyState';

function render(props: React.ComponentProps<typeof EmptyState>) {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<EmptyState {...props} />);
  });
  return tree!;
}

describe('EmptyState', () => {
  test('renders the icon, title, and body together', () => {
    const tree = render({ icon: Search, title: 'No results', body: 'Try again' });
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).toContain('No results');
    expect(serialized).toContain('Try again');
  });

  test('renders the title text', () => {
    const tree = render({ icon: Search, title: 'Title X', body: 'Body X' });
    const texts = tree.root.findAllByType(Text);
    const titles = texts.filter((n) =>
      JSON.stringify(n.props.children).includes('Title X'),
    );
    expect(titles.length).toBeGreaterThan(0);
  });

  test('renders the body text', () => {
    const tree = render({ icon: Search, title: 'Title Y', body: 'Body Y' });
    const texts = tree.root.findAllByType(Text);
    const bodies = texts.filter((n) =>
      JSON.stringify(n.props.children).includes('Body Y'),
    );
    expect(bodies.length).toBeGreaterThan(0);
  });

  test('forwards 40px size prop to the supplied Lucide icon', () => {
    const tree = render({ icon: Search, title: 'T', body: 'B' });
    const serialized = JSON.stringify(tree.toJSON());
    // lucide-react-native is mocked in jest.setup.js to passthrough all props
    // as an `Icon` element, so the size=40 prop shows up on the rendered tree.
    expect(serialized).toMatch(/"size":40/);
  });
});

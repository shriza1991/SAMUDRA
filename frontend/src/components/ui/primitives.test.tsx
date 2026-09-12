import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardHeader, CardTitle, CardContent } from './card';

describe('shadcn UI primitives', () => {
  it('renders Button with variants correctly', () => {
    const html = renderToString(<Button variant="outline">Test Button</Button>);
    expect(html).toContain('Test Button');
  });

  it('renders Badge with domain safety variants', () => {
    const html = renderToString(<Badge variant="go">GO - Safe</Badge>);
    expect(html).toContain('GO - Safe');
    expect(html).toContain('bg-emerald-500/15');
  });

  it('renders Card container structure', () => {
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Mission Card</CardTitle>
        </CardHeader>
        <CardContent>Content Area</CardContent>
      </Card>
    );
    expect(html).toContain('Mission Card');
    expect(html).toContain('Content Area');
  });
});

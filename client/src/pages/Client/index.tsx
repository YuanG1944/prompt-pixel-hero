import Playground from '../../playground/Playground';

export default function Client() {
  const side = (new URLSearchParams(location.search).get('side') === 'B' ? 'B' : 'A') as 'A' | 'B';
  return <Playground mode='client' side={side} />;
}

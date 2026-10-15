import { beforeEach, describe, expect, it } from 'vitest';
import { createClassic } from '../../src/watch/classic';
import { watchState } from '../../src/watch/movement-model';

let mount: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; });

describe('Classic face', () => {
  it('keeps today\'s look: 60 ticks, three line hands, a centre dot', () => {
    const face = createClassic(mount);
    expect(face.root.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(face.root.querySelectorAll('line')).toHaveLength(63);
    expect(face.root.querySelector('.second-hand')).not.toBeNull();
  });
  it('sweeps the seconds smoothly', () => {
    const face = createClassic(mount);
    face.render(watchState(1_500, false));
    expect(face.root.querySelector('#hand-second')!.getAttribute('transform')).toBe('rotate(9 100 100)');
  });
  it('destroy removes it', () => {
    createClassic(mount).destroy();
    expect(mount.children).toHaveLength(0);
  });
});

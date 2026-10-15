import { beforeEach, describe, expect, it } from 'vitest';
import { createFullBleed } from '../../src/watch/full-bleed';
import { watchState } from '../../src/watch/movement-model';

let mount: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; });

describe('Full bleed face', () => {
  it('draws a 200-unit dial with the 12/3/6/9 numerals in Latin digits', () => {
    const face = createFullBleed(mount);
    expect(face.root.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(face.root.classList.contains('clock')).toBe(true);
    expect([...face.root.querySelectorAll('.wf-num')].map((t) => t.textContent)).toEqual(['12', '3', '6', '9']);
  });

  it('has 56 track marks (60 minus the four numeral positions), 8 of them major', () => {
    const face = createFullBleed(mount);
    expect(face.root.querySelectorAll('.wf-tick')).toHaveLength(56);
    expect(face.root.querySelectorAll('.wf-tick--major')).toHaveLength(8);
  });

  it('sets no colours as attributes, so the theme restyles it live', () => {
    const face = createFullBleed(mount);
    for (const node of face.root.querySelectorAll('*')) {
      for (const attr of ['fill', 'stroke', 'stop-color']) {
        const v = node.getAttribute(attr);
        if (v !== null) expect(v, `${node.tagName} ${attr}`).toMatch(/^(none|url\(#.+\)|var\(--w-[a-z0-9-]+\))$/);
      }
    }
  });

  it('turns the hands from the state, around the centre', () => {
    const face = createFullBleed(mount);
    face.render(watchState(((10 * 60 + 30) * 60) * 1000, false));
    expect(face.root.querySelector('#hand-hour')!.getAttribute('transform')).toBe('rotate(315 100 100)');
    expect(face.root.querySelector('#hand-minute')!.getAttribute('transform')).toBe('rotate(180 100 100)');
    expect(face.root.querySelector('#hand-second')!.getAttribute('transform')).toBe('rotate(0 100 100)');
  });

  it('destroy removes it', () => {
    createFullBleed(mount).destroy();
    expect(mount.children).toHaveLength(0);
  });
});

import { SHOOT_BUFFER_TICKS } from '../config/controls';
import {
  consumeAction,
  createInputSource,
  pressAction,
  sampleIntent,
  setMove,
  setSprint,
} from './source';

describe('input source', () => {
  it('creates an empty source and clamps movement axes', () => {
    const source = createInputSource();

    expect(source).toEqual({
      moveX: 0,
      moveZ: 0,
      sprint: false,
      shootBuf: 0,
      passBuf: 0,
      tackleBuf: 0,
      switchBuf: 0,
    });

    setMove(source, 2, -3);
    setSprint(source, true);

    expect(sampleIntent(source)).toMatchObject({
      moveX: 1,
      moveZ: -1,
      sprint: true,
    });
  });

  it('latches actions into buffers and decrements once per sample', () => {
    const source = createInputSource();

    pressAction(source, 'shoot');
    pressAction(source, 'pass');

    const intent = sampleIntent(source);

    expect(intent.shoot).toBe(true);
    expect(intent.pass).toBe(true);
    expect(intent.tackle).toBe(false);
    expect(source.shootBuf).toBe(SHOOT_BUFFER_TICKS - 1);
    expect(source.passBuf).toBe(SHOOT_BUFFER_TICKS - 1);
    expect(source.tackleBuf).toBe(0);
  });

  it('latches switch into a buffer and decrements once per sample', () => {
    const source = createInputSource();

    pressAction(source, 'switch');

    const intent = sampleIntent(source);

    expect(intent.switch).toBe(true);
    expect(source.switchBuf).toBe(SHOOT_BUFFER_TICKS - 1);
  });

  it('empties switch after the configured number of samples', () => {
    const source = createInputSource();

    pressAction(source, 'switch');

    for (let i = 0; i < SHOOT_BUFFER_TICKS; i += 1) {
      expect(sampleIntent(source).switch).toBe(true);
    }

    expect(source.switchBuf).toBe(0);
    expect(sampleIntent(source).switch).toBe(false);
  });

  it('empties an action buffer after the configured number of samples', () => {
    const source = createInputSource();

    pressAction(source, 'shoot');

    for (let i = 0; i < SHOOT_BUFFER_TICKS; i += 1) {
      expect(sampleIntent(source).shoot).toBe(true);
    }

    expect(source.shootBuf).toBe(0);
    expect(sampleIntent(source).shoot).toBe(false);
  });

  it('consumes an action buffer immediately', () => {
    const source = createInputSource();

    pressAction(source, 'tackle');
    consumeAction(source, 'tackle');

    expect(source.tackleBuf).toBe(0);
    expect(sampleIntent(source).tackle).toBe(false);
  });

  it('consumes the switch buffer immediately', () => {
    const source = createInputSource();

    pressAction(source, 'switch');
    consumeAction(source, 'switch');

    expect(source.switchBuf).toBe(0);
    expect(sampleIntent(source).switch).toBe(false);
  });
});

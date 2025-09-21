const somar = (a: number, b: number): number => a + b;

describe('somar', () => {
  test('retorna 3 ao somar 1 + 2', () => {
    expect(somar(1, 2)).toBe(3);
  });
});

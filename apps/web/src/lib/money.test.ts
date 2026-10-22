import {describe,it,expect} from 'vitest';
import {formatMoney,reaisToCents} from './api';
describe('valores de carteira e lances',()=>{
  it('converte reais em centavos inteiros',()=>{
    expect(reaisToCents('120,50')).toBe(12050);
    expect(reaisToCents('1.99')).toBe(199);
  });
  it('rejeita montantes negativos e inválidos',()=>{
    expect(()=>reaisToCents('-20')).toThrow();
    expect(()=>reaisToCents('abc')).toThrow();
  });
  it('formata valores exibidos em reais',()=>{
    expect(formatMoney('12345')).toContain('123,45');
  });
});

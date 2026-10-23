import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableTransactionError, withTransactionRetry } from '../src/lib/db.js';

function rawConflict(code = '40001') {
  return Object.assign(new Error('Raw query failed'), {code:'P2010',meta:{code}});
}

test('detecta conflito SQLSTATE em P2010, erro direto e P2034', () => {
  assert.equal(isRetryableTransactionError(rawConflict('40001')), true);
  assert.equal(isRetryableTransactionError(rawConflict('40P01')), true);
  assert.equal(isRetryableTransactionError({code:'P2034'}), true);
  assert.equal(isRetryableTransactionError({code:'40001'}), true);
  assert.equal(isRetryableTransactionError({code:'40P01'}), true);
  assert.equal(isRetryableTransactionError(rawConflict('23505')), false);
  assert.equal(isRetryableTransactionError({code:'P2010'}), false);
  assert.equal(isRetryableTransactionError({code:'P1000'}), false);
});

test('reexecuta a transação inteira após conflito de serialização', async () => {
  let executions = 0;
  const result = await withTransactionRetry(async () => {
    executions++;
    if (executions === 1) throw rawConflict();
    return 'finalizado';
  }, 3);
  assert.equal(result,'finalizado');
  assert.equal(executions,2);
});

test('não repete falhas de query que não são conflitos', async () => {
  const error = rawConflict('23505');
  let executions = 0;
  await assert.rejects(() => withTransactionRetry(async () => {
    executions++;
    throw error;
  }, 4), (caught) => caught === error);
  assert.equal(executions,1);
});

test('preserva erro de concorrência quando esgota as tentativas', async () => {
  const error = rawConflict();
  let executions = 0;
  await assert.rejects(() => withTransactionRetry(async () => {
    executions++;
    throw error;
  }, 2), (caught) => caught === error);
  assert.equal(executions,2);
});

// Builds the TeX for one cell's numerical substitution. Formatting only: every number comes from the backend response.
import type { BackwardStep, ForwardCell, ViterbiCell } from '../types'
import { tex, texObs, texState } from './format'

export function forwardCellTex(cell: ForwardCell, t: number, obs: string): string[] {
  const j = texState(cell.state)
  if (t === 1) {
    return [
      String.raw`\alpha_1(${j}) = \pi_{${j}} \cdot b_{${j}}(${texObs(obs)})`,
      String.raw`= ${tex(cell.sum)} \times ${tex(cell.emission)} = \mathbf{${tex(cell.value)}}`,
    ]
  }
  const sumSym = cell.terms.map((tm) => String.raw`\alpha_{${t - 1}}(${texState(tm.from)})\,a_{${texState(tm.from)}\to ${j}}`).join(' + ')
  const sumNum = cell.terms.map((tm) => `${tex(tm.prev)} \\times ${tex(tm.a)}`).join(' + ')
  const prods = cell.terms.map((tm) => tex(tm.product)).join(' + ')
  return [
    String.raw`\alpha_{${t}}(${j}) = \Big[${sumSym}\Big] \cdot b_{${j}}(${texObs(obs)})`,
    String.raw`= \big[${sumNum}\big] \times ${tex(cell.emission)}`,
    String.raw`= \big[${prods}\big] \times ${tex(cell.emission)} = ${tex(cell.sum)} \times ${tex(cell.emission)} = \mathbf{${tex(cell.value)}}`,
  ]
}

export function backwardCellTex(step: BackwardStep, i: number): string[] {
  const cell = step.cells[i]
  const s = texState(i)
  if (step.next_observation_name === null) return [String.raw`\beta_{${step.t}}(${s}) = 1 \quad\text{(initialization: nothing left to explain)}`]
  const o = texObs(step.next_observation_name)
  const sym = cell.terms.map((tm) => String.raw`a_{${s}\to${texState(tm.to)}}\, b_{${texState(tm.to)}}(${o})\, \beta_{${step.t + 1}}(${texState(tm.to)})`).join(' + ')
  const num = cell.terms.map((tm) => `${tex(tm.a)}\\times${tex(tm.emission)}\\times${tex(tm.next)}`).join(' + ')
  const prods = cell.terms.map((tm) => tex(tm.product)).join(' + ')
  return [
    String.raw`\beta_{${step.t}}(${s}) = ${sym}`,
    String.raw`= ${num}`,
    String.raw`= ${prods} = \mathbf{${tex(cell.value)}}`,
  ]
}

export function viterbiCellTex(cell: ViterbiCell, t: number, obs: string): string[] {
  const j = texState(cell.state)
  if (t === 1)
    return [String.raw`\delta_1(${j}) = \pi_{${j}}\, b_{${j}}(${texObs(obs)}) = ${tex(cell.max)} \times ${tex(cell.emission)} = \mathbf{${tex(cell.value)}}`]
  const cands = cell.candidates
    .map((c) => {
      const body = `${tex(c.prev)}\\times${tex(c.a)} = ${tex(c.product)}`
      return c.from === cell.best_from ? `\\boxed{${body}}` : body
    })
    .join(',\\; ')
  return [
    String.raw`\delta_{${t}}(${j}) = \max_i \big[\delta_{${t - 1}}(i)\, a_{i\to ${j}}\big] \cdot b_{${j}}(${texObs(obs)})`,
    String.raw`\max\big\{${cands}\big\} = ${tex(cell.max)} \;\;(\text{from } ${texState(cell.best_from)})`,
    String.raw`\delta_{${t}}(${j}) = ${tex(cell.max)} \times ${tex(cell.emission)} = \mathbf{${tex(cell.value)}}, \qquad \psi_{${t}}(${j}) = ${texState(cell.best_from)}`,
  ]
}

import { CreditCard, Eye, LogOut, PackageCheck, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { ObservationName } from '../types'

export const STATE_NAMES = ['Browsing', 'Interested', 'Ready to Purchase'] as const
export const STATE_SHORT = ['Browsing', 'Interested', 'Ready'] as const
export const STATE_SYMBOL = ['B', 'I', 'R'] as const
export const STATE_COLORS = ['#4288e0', '#c4872a', '#1fa97c'] as const

export const OBS_NAMES: ObservationName[] = ['View', 'Cart', 'Checkout', 'Purchase', 'Exit']

export const OBS_META: Record<ObservationName, { icon: LucideIcon; color: string; hint: string }> = {
  View: { icon: Eye, color: '#93a4c8', hint: 'Opened a product page' },
  Cart: { icon: ShoppingCart, color: '#fbbf24', hint: 'Added a product to the cart' },
  Checkout: { icon: CreditCard, color: '#fb923c', hint: 'Entered the checkout flow' },
  Purchase: { icon: PackageCheck, color: '#34d399', hint: 'Completed an order' },
  Exit: { icon: LogOut, color: '#f87171', hint: 'Left the platform' },
}

export const DEFAULT_SEQUENCE: ObservationName[] = ['View', 'Cart', 'Checkout', 'Purchase']

export const EXAMPLES: { id: string; name: string; observations: ObservationName[]; story: string }[] = [
  { id: 'A', name: 'Quick bounce', observations: ['View', 'View', 'Exit'], story: 'Looks at two products and leaves.' },
  { id: 'B', name: 'Reached checkout', observations: ['View', 'Cart', 'Checkout'], story: 'Adds to cart and starts checkout, outcome unknown.' },
  { id: 'C', name: 'Fast purchase', observations: ['View', 'Cart', 'Purchase'], story: 'Finds a product and buys it quickly.' },
  {
    id: 'D',
    name: 'Considered purchase',
    observations: ['View', 'View', 'Cart', 'Checkout', 'Purchase'],
    story: 'Compares, adds to cart, checks out and buys.',
  },
]

/** Compact axis labels for the dataset behaviour categories. */
export const BEHAVIOUR_SHORT: Record<string, string> = {
  'Casual browsing': 'Casual',
  'Repeated product viewing': 'Repeat view',
  'Cart abandonment': 'Cart aband.',
  'Checkout abandonment': 'Checkout aband.',
  'Successful purchase': 'Purchase',
  'High purchase intent': 'High intent',
}

/** Small hand-labelled journeys. The labels are INPUTS to supervised MLE (pretend an analyst annotated them). */
export const LABELLED_EXAMPLE: { observations: ObservationName[]; hidden_states: string[] }[] = [
  { observations: ['View', 'View', 'Cart', 'Purchase'], hidden_states: ['Browsing', 'Browsing', 'Interested', 'Ready'] },
  { observations: ['View', 'Cart', 'Exit'], hidden_states: ['Browsing', 'Interested', 'Interested'] },
  { observations: ['View', 'View', 'Exit'], hidden_states: ['Browsing', 'Browsing', 'Browsing'] },
  { observations: ['Cart', 'Checkout', 'Purchase'], hidden_states: ['Interested', 'Ready', 'Ready'] },
]

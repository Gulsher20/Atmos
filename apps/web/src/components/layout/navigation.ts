import { Bell, CloudSun, GitCompare, History, MapPin, Settings, Target } from 'lucide-vue-next'

export const NAV_ITEMS = [
  { to: '/', label: 'Today', icon: CloudSun, mobile: true },
  { to: '/locations', label: 'Places', icon: MapPin, mobile: true },
  { to: '/compare', label: 'Compare', icon: GitCompare, mobile: true },
  { to: '/history', label: 'History', icon: History, mobile: true },
  { to: '/accuracy', label: 'Accuracy', icon: Target, mobile: true },
  { to: '/alerts', label: 'Alerts', icon: Bell, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
] as const

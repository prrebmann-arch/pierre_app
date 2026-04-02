'use client'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="athlete-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`athlete-tab-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

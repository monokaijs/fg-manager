"use client"

import { ChevronRightIcon, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  groupLabel,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    badge?: React.ReactNode
    items?: {
      title: string
      url: string
    }[]
  }[]
  groupLabel?: string
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel ?? 'Platform'}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            render={<SidebarMenuItem />}
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            {item.items && item.items.length > 0 ? (
              <>
                <CollapsibleTrigger render={
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[open]/collapsible:rotate-90 group-data-[panel-open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                } />
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton 
                          isActive={location.pathname === subItem.url || (location.pathname === "/" && subItem.url === "/games")}
                          render={<Link to={subItem.url} />}
                        >
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </>
            ) : (
              <SidebarMenuButton 
                tooltip={item.title} 
                isActive={location.pathname.startsWith(item.url) && item.url !== "/" || location.pathname === item.url}
                render={<Link to={item.url} />}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                {item.badge && <div className="ml-auto">{item.badge}</div>}
              </SidebarMenuButton>
            )}
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

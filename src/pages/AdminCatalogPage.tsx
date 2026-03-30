import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'

export function AdminCatalogPage() {
  const { catalogs } = useAppData()

  const groups = [
    ['Trang thai du an', catalogs.projectStatuses],
    ['Health status', catalogs.healthStatuses],
    ['Trang thai cong viec', catalogs.taskStatuses],
    ['Muc do rui ro', catalogs.riskLevels],
    ['Loai tai lieu', catalogs.documentCategories],
    ['Don vi', catalogs.departments],
    ['Vai tro to trien khai', catalogs.projectMemberRoles],
  ] as const

  return (
    <div className="page-grid">
      <SectionHeader
        title="Danh muc he thong"
        description="Khung quan tri LOV de sau nay noi CRUD day du cho vai tro, trang thai va danh muc"
      />

      <section className="catalog-grid">
        {groups.map(([title, items]) => (
          <article key={title} className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Catalog group</span>
                <h3>{title}</h3>
              </div>
              <StatusPill label={`${items.length} gia tri`} tone="info" />
            </div>

            <div className="stack-list">
              {items.map((item) => (
                <div key={item.value} className="list-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

package model

type StateCount struct {
	State string `gorm:"column:state" json:"state"`
	Count int64  `gorm:"column:count" json:"count"`
}

type PriorityCount struct {
	Priority string `gorm:"column:priority" json:"priority"`
	Count    int64  `gorm:"column:count" json:"count"`
}

type AssigneeCount struct {
	Email string `gorm:"column:email" json:"email"`
	Count int64  `gorm:"column:count" json:"count"`
}

type LabelCount struct {
	Label string `gorm:"column:label" json:"label"`
	Count int64  `gorm:"column:count" json:"count"`
}

type WorkspaceIssueExport struct {
	ID       string `gorm:"column:id" json:"id"`
	Name     string `gorm:"column:name" json:"name"`
	State    string `gorm:"column:state" json:"state"`
	Priority string `gorm:"column:priority" json:"priority"`
}

type ProjectIssueExport struct {
	ID    string `gorm:"column:id" json:"id"`
	Name  string `gorm:"column:name" json:"name"`
	State string `gorm:"column:state" json:"state"`
}

type TrendPoint struct {
	Date     string `gorm:"column:date" json:"date"`
	Created  int64  `gorm:"column:created" json:"created"`
	Resolved int64  `gorm:"column:resolved" json:"resolved"`
}

/** SQLite schema 13 transfer allowlist. Never include credentials or device-local file paths. */
export const WORKSPACE_TABLES = {
  "categories": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "icon": {
      "type": "text",
      "nullable": true
    },
    "is_default": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "subcategories": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "category_id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "is_default": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "personal_expenses": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "category_id": {
      "type": "text",
      "nullable": false
    },
    "description": {
      "type": "text",
      "nullable": true
    },
    "payment_method": {
      "type": "text",
      "nullable": false
    },
    "expense_date": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "subcategory_id": {
      "type": "text",
      "nullable": true
    }
  },
  "employee_details": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "employee_code": {
      "type": "text",
      "nullable": false
    },
    "grade": {
      "type": "text",
      "nullable": false
    },
    "department": {
      "type": "text",
      "nullable": false
    },
    "location": {
      "type": "text",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "mobile_no": {
      "type": "text",
      "nullable": true
    }
  },
  "local_conveyance": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "date": {
      "type": "integer",
      "nullable": false
    },
    "particulars": {
      "type": "text",
      "nullable": false
    },
    "mode": {
      "type": "text",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "outstation_conveyance": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "date": {
      "type": "integer",
      "nullable": false
    },
    "from_location": {
      "type": "text",
      "nullable": false
    },
    "departure_time": {
      "type": "integer",
      "nullable": true
    },
    "to_location": {
      "type": "text",
      "nullable": false
    },
    "arrival_time": {
      "type": "integer",
      "nullable": true
    },
    "mode": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    }
  },
  "hotel": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "hotel_name": {
      "type": "text",
      "nullable": false
    },
    "bill_no": {
      "type": "text",
      "nullable": true
    },
    "start_date": {
      "type": "integer",
      "nullable": false
    },
    "end_date": {
      "type": "integer",
      "nullable": false
    },
    "no_of_days": {
      "type": "integer",
      "nullable": false
    },
    "rate_per_day": {
      "type": "integer",
      "nullable": false
    },
    "food_amount": {
      "type": "integer",
      "nullable": true
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    }
  },
  "tour_conveyance": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "date": {
      "type": "integer",
      "nullable": false
    },
    "from_location": {
      "type": "text",
      "nullable": false
    },
    "to_location": {
      "type": "text",
      "nullable": false
    },
    "mode": {
      "type": "text",
      "nullable": false
    },
    "fare": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    }
  },
  "phone_expense": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "date": {
      "type": "integer",
      "nullable": false
    },
    "particulars": {
      "type": "text",
      "nullable": false
    },
    "tel_fax_no": {
      "type": "text",
      "nullable": false
    },
    "bill_no": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    }
  },
  "miscellaneous_expense": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "date": {
      "type": "integer",
      "nullable": false
    },
    "particulars": {
      "type": "text",
      "nullable": false
    },
    "bill_no": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "complaint_no": {
      "type": "text",
      "nullable": false
    }
  },
  "daily_allowance": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "employee_id": {
      "type": "text",
      "nullable": false
    },
    "travel_allowance": {
      "type": "integer",
      "nullable": false
    },
    "food_allowance": {
      "type": "integer",
      "nullable": false
    },
    "total_amount": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    },
    "no_of_days": {
      "type": "integer",
      "nullable": false
    },
    "start_date": {
      "type": "integer",
      "nullable": true
    },
    "end_date": {
      "type": "integer",
      "nullable": true
    }
  },
  "split_groups": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "updated_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "split_people": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "group_id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "split_expenses": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "group_id": {
      "type": "text",
      "nullable": false
    },
    "description": {
      "type": "text",
      "nullable": true
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "paid_by_person_id": {
      "type": "text",
      "nullable": false
    },
    "expense_date": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "recurring_expenses": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "category_id": {
      "type": "text",
      "nullable": false
    },
    "subcategory_id": {
      "type": "text",
      "nullable": true
    },
    "description": {
      "type": "text",
      "nullable": true
    },
    "payment_method": {
      "type": "text",
      "nullable": false
    },
    "day_of_month": {
      "type": "integer",
      "nullable": false
    },
    "next_due": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "subscriptions": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "category_id": {
      "type": "text",
      "nullable": false
    },
    "subcategory_id": {
      "type": "text",
      "nullable": true
    },
    "payment_method": {
      "type": "text",
      "nullable": false
    },
    "day_of_month": {
      "type": "integer",
      "nullable": false
    },
    "next_due": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "investment_plans": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "day_of_month": {
      "type": "integer",
      "nullable": false
    },
    "next_due": {
      "type": "integer",
      "nullable": false
    },
    "active": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    },
    "frequency": {
      "type": "text",
      "nullable": false
    }
  },
  "investment_contributions": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "plan_id": {
      "type": "text",
      "nullable": false
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "due_at": {
      "type": "integer",
      "nullable": false
    },
    "invested_at": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "vehicles": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "name": {
      "type": "text",
      "nullable": false
    },
    "kind": {
      "type": "text",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "fuel_refills": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "vehicle_id": {
      "type": "text",
      "nullable": false
    },
    "expense_id": {
      "type": "text",
      "nullable": true
    },
    "amount": {
      "type": "integer",
      "nullable": false
    },
    "litres": {
      "type": "real",
      "nullable": false
    },
    "odometer": {
      "type": "real",
      "nullable": false
    },
    "expense_date": {
      "type": "integer",
      "nullable": false
    },
    "payment_method": {
      "type": "text",
      "nullable": false
    },
    "location": {
      "type": "text",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  },
  "app_preferences": {
    "key": {
      "type": "text",
      "nullable": false
    },
    "value": {
      "type": "text",
      "nullable": false
    }
  },
  "company_expense_attachments": {
    "id": {
      "type": "text",
      "nullable": false
    },
    "expense_type": {
      "type": "text",
      "nullable": false
    },
    "expense_id": {
      "type": "text",
      "nullable": false
    },
    "file_name": {
      "type": "text",
      "nullable": false
    },
    "mime_type": {
      "type": "text",
      "nullable": false
    },
    "size_bytes": {
      "type": "integer",
      "nullable": false
    },
    "created_at": {
      "type": "integer",
      "nullable": false
    }
  }
} as const;
export type WorkspaceTable = keyof typeof WORKSPACE_TABLES;
export type DataRow = Record<string, string | number | null>;
export const MAX_WORKSPACE_BYTES = 16 * 1024 * 1024;
export const CHUNK_BYTES = 300_000;
export const MAX_TABLE_ROWS = 3000;
export const MAX_WORKSPACE_RECORDS = 20000;
export const preferenceAllowed = (key: string) => ['@payment_app_appearance', '@payment_app_daily_allowance_rates', 'monthly_budget_paise', 'reminder.subscription.enabled', 'reminder.recurring.enabled', 'reminder.investment.enabled', 'reminder.time'].includes(key) || /^category_budget_paise:[0-9a-f-]{36}$/i.test(key);

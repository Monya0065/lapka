from src.repositories.appointments import (
    count_appointments,
    create_appointment,
    delete_appointment,
    get_appointment,
    get_upcoming_appointments_for_clinic,
    list_appointments,
    list_appointments_for_clinic,
    list_appointments_for_owner,
    update_appointment,
    add_appointment,
)
from src.repositories.audit import (
    count_audit_events,
    create_audit_event,
    get_audit_event,
    list_audit_events,
)
from src.repositories.clinics import (
    count_clinics,
    create_membership,
    get_clinic,
    get_clinic_by_slug,
    get_clinic_members,
    get_clinic_with_members,
    get_membership,
    get_user_memberships,
    list_clinics,
    search_clinics,
    update_membership,
)
from src.repositories.consents import (
    create_consent,
    get_consent,
    list_consents_for_owner,
)
from src.repositories.documents import (
    count_documents,
    create_document,
    delete_document,
    get_document,
    get_document_by_token,
    list_documents,
    list_documents_for_pet,
    search_documents,
    update_document,
)
from src.repositories.inpatient import (
    count_inpatient_stays,
    create_inpatient_stay,
    get_active_stay_for_pet,
    get_inpatient_stay,
    list_active_stays_for_clinic,
    list_inpatient_stays,
    list_stays_for_pet,
    update_inpatient_stay,
)
from src.repositories.memberships import (
    activate_membership,
    count_memberships,
    create_membership,
    deactivate_membership,
    delete_membership,
    get_membership,
    get_membership_by_user_clinic,
    list_clinic_admins,
    list_clinic_vets,
    list_memberships_for_clinic,
    list_memberships_for_user,
    update_membership,
)
from src.repositories.notifications import (
    count_unread_notifications,
    create_notification,
    delete_notification,
    get_notification,
    get_notification_preferences,
    upsert_notification_preferences,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from src.repositories.pets import get_pet
from src.repositories.users import (
    count_users,
    create_user,
    deactivate_user,
    get_user_by_email,
    get_user_by_id,
    list_owners,
    list_users,
    list_vets_for_clinic,
    search_users,
    update_user,
)
from src.repositories.visits import (
    count_visits,
    create_visit,
    get_latest_visit_for_pet,
    get_visit,
    list_visits,
    list_visits_for_owner,
    list_visits_for_pet,
    update_visit,
)
export default function Privacy() {
  return (
    <main className="wrap prose">
      <h1>Datenschutz / Privacy Policy</h1>
      <p>
        Dieses Dashboard ist ein privates Tool, mit dem der Betreiber ausschließlich seine eigenen Social-Media-Accounts
        (TikTok, Instagram, YouTube) auswertet. Es werden nur öffentliche Profildaten (Name, Profilbild, Follower) sowie
        Videos und deren Statistiken (Views, Likes, Kommentare, Shares) der verbundenen eigenen Accounts gespeichert.
        Es werden keine Daten an Dritte weitergegeben oder verkauft. Zugangs-Tokens werden verschlüsselt übertragen und nur
        zum Abruf dieser Statistiken genutzt. Eine Verbindung kann jederzeit unter „Verwalten“ getrennt werden; dabei werden
        alle zugehörigen Daten gelöscht.
      </p>
      <p>
        This dashboard is a private tool used by its operator to view analytics for their own social media accounts only.
        It stores public profile data and video statistics of connected accounts, does not share or sell any data, and
        deletes all related data when an account is disconnected.
      </p>
    </main>
  );
}

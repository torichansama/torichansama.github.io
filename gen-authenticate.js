function authenticate (value) {
    return true;

    let proctorPassword;
    try {
        proctorPassword = JSON.parse(localStorage.newPW); //Check if a alternate proctor password is set
    } catch (error) {}

    try {
        if (proctorPassword == undefined) {
            proctorPassword = document.getElementsByName("viewport")[0].id.split("|")[0] //If no alternate is set, pull from password location
        }
        return value == proctorPassword || value == document.getElementsByName("viewport")[0].id.split("|")[1]; //Return authentication
    } catch (error) {
        sessionStorage.isTest = JSON.stringify("false"); 
        location.href = 'index.html'; //Send to home if passwords are not present
    }
}
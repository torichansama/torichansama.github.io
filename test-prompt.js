function Prompt (text, backgroundColor, PromptElements) {
    this.text = text;
    this.backgroundColor = backgroundColor;
    this.PromptElements = PromptElements;
    this.htmlElement;

    initializePrompt(this);
}

function PromptElement (elementType, content, iconColor, action) {
    this.elementType = elementType;
    this.content = content;
    this.iconColor = iconColor;
    this.action = action;
}

function activatePrompt(prompt) {
    if (activePrompt) {cancelPrompt();}
    activePrompt = prompt;
    prompt.htmlElement.style.display = "inline";
}

function cancelPrompt() {
    activePrompt.htmlElement.style.display = "none";
    activePrompt = null;
}

//Given the JS descriptions of each prompt, create an HTML element for each and reference that into the JS prompt object
function initializePrompt(prompt) {
    let modal = document.createElement("div"); //Initialize all modal elements
    let modalContent = document.createElement("div");
    let text = document.createElement("p");
    let buttons = document.createElement("div");

    modal.className = "modal"; //Set attributes and classes of elements
    modal.style.backgroundColor = prompt.backgroundColor;

    modalContent.className = "modal-content";

    buttons.className = "modal-buttonDiv";

    text.innerHTML = prompt.text;

    prompt.PromptElements.forEach(PromptElement => { //Create the buttons for the modal
        if (PromptElement.elementType == "button") {
            let button = document.createElement("button");
            button.className = "iconButton";
            button.style.color =  PromptElement.iconColor;
            button.onclick = PromptElement.action;

            let content;
            if (PromptElement.content.includes("fa")) {
                content = document.createElement("i");
                content.className = PromptElement.content;
            } else {
                content = document.createElement("p");
                content.innerHTML = PromptElement.content;
                content.style.marginTop = "0px";
                content.style.marginBottom = "0px";
            }
            button.appendChild(content)

            buttons.appendChild(button);
        } else if (PromptElement.elementType == "throbber") {
            let throbber = document.createElement("div");
            throbber.className = "loader";

            buttons.appendChild(throbber);
        }
    });

    modalContent.appendChild(text); //Create family tree
    modalContent.appendChild(buttons);
    
    if (prompt.text != "") { //Empty prompts shouldn't have content added
        modal.appendChild(modalContent);
    }

    document.body.appendChild(modal);
    prompt.htmlElement = modal;
}